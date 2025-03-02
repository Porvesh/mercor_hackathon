@group(0) @binding(0) var texture_sampler: sampler;
@group(0) @binding(1) var texture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> uniforms: RenderUniforms;
@group(0) @binding(3) var thickness_texture: texture_2d<f32>;
@group(0) @binding(4) var envmap_texture: texture_cube<f32>;

struct RenderUniforms {
    texel_size: vec2f, 
    sphere_size: f32, 
    inv_projection_matrix: mat4x4f, 
    projection_matrix: mat4x4f, 
    view_matrix: mat4x4f, 
    inv_view_matrix: mat4x4f, 
}

struct FragmentInput {
    @location(0) uv: vec2f, 
    @location(1) iuv: vec2f, 
}

// Cache uniforms that are used multiple times to reduce binding access
fn computeViewPosFromUVDepth(tex_coord: vec2f, depth: f32, inv_proj: mat4x4f, proj_z: f32, proj_w: f32) -> vec3f {
    // Compute NDC coordinates
    let ndc = vec4f(
        tex_coord.x * 2.0 - 1.0,
        1.0 - 2.0 * tex_coord.y,
        -proj_z + proj_w / depth,
        1.0
    );
    
    // Transform to view space
    let eye_pos = inv_proj * ndc;
    let inv_w = 1.0 / eye_pos.w; // Multiply is faster than divide on M1
    
    return eye_pos.xyz * inv_w;
}

// Pack texture reads to minimize latency
@fragment
fn fs(input: FragmentInput) -> @location(0) vec4f {
    // Cache uniform values to reduce binding access
    let inv_proj = uniforms.inv_projection_matrix;
    let proj_z = uniforms.projection_matrix[2].z;
    let proj_w = uniforms.projection_matrix[3].z;
    let texel_size = uniforms.texel_size;
    let inv_view = uniforms.inv_view_matrix;
    let view = uniforms.view_matrix;
    
    // Precompute texture coordinates for all reads to batch memory operations
    let iuv = vec2u(input.iuv);
    let iuv_right = vec2u(input.iuv + vec2f(1.0, 0.0));
    let iuv_left = vec2u(input.iuv + vec2f(-1.0, 0.0));
    let iuv_up = vec2u(input.iuv + vec2f(0.0, 1.0));
    let iuv_down = vec2u(input.iuv + vec2f(0.0, -1.0));
    
    let uv_right = input.uv + vec2f(texel_size.x, 0.0);
    let uv_left = input.uv + vec2f(-texel_size.x, 0.0);
    let uv_up = input.uv + vec2f(0.0, texel_size.y);
    let uv_down = input.uv + vec2f(0.0, -texel_size.y);
    
    // Group texture reads to leverage cache locality
    let depth_center = abs(textureLoad(texture, iuv, 0).r);
    
    // Early-out for background - benefits TBDR architecture
    if (depth_center >= 1e4 || depth_center <= 0.0) {
        return vec4f(0.8, 0.8, 0.8, 1.0);
    }
    
    // Batch compute all depth samples needed
    let depth_right = abs(textureLoad(texture, iuv_right, 0).r);
    let depth_left = abs(textureLoad(texture, iuv_left, 0).r);
    let depth_up = abs(textureLoad(texture, iuv_up, 0).r);
    let depth_down = abs(textureLoad(texture, iuv_down, 0).r);
    
    // Pre-fetch thickness in same batch as depths
    let thickness = textureLoad(thickness_texture, iuv, 0).r;
    
    // Compute view positions with cached uniform values
    let viewPos = computeViewPosFromUVDepth(input.uv, depth_center, inv_proj, proj_z, proj_w);
    let viewPos_right = computeViewPosFromUVDepth(uv_right, depth_right, inv_proj, proj_z, proj_w);
    let viewPos_left = computeViewPosFromUVDepth(uv_left, depth_left, inv_proj, proj_z, proj_w);
    let viewPos_up = computeViewPosFromUVDepth(uv_up, depth_up, inv_proj, proj_z, proj_w);
    let viewPos_down = computeViewPosFromUVDepth(uv_down, depth_down, inv_proj, proj_z, proj_w);
    
    // Calculate derivatives
    var ddx = viewPos_right - viewPos;
    var ddy = viewPos_up - viewPos;
    let ddx2 = viewPos - viewPos_left;
    let ddy2 = viewPos - viewPos_down;
    
    // Use branchless select where it makes sense
    ddx = select(ddx, ddx2, abs(ddx.z) > abs(ddx2.z));
    ddy = select(ddy, ddy2, abs(ddy.z) > abs(ddy2.z));
    
    // Normal calculation - cross product very efficient on M1
    let normal = -normalize(cross(ddx, ddy));
    
    // High ALU to memory ratio calculations for M1 efficiency
    let rayDir = normalize(viewPos);
    let lightDir = normalize((view * vec4f(0.0, 0.0, -1.0, 0.0)).xyz);
    let H = normalize(lightDir - rayDir);
    
    // Optimize dot products - very efficient on M1
    let n_dot_h = max(0.0, dot(H, normal));
    let n_dot_l = max(0.0, dot(lightDir, normal));
    let n_dot_v = dot(normal, -rayDir);
    
    // Fast math for specular - use built-in pow for performance
    let specular = pow(n_dot_h, 250.0);
    
    // Combine ALU operations for better instruction packing
    let diffuseColor = vec3f(0.085, 0.6375, 0.9);
    let bgColor = vec3f(0.8);
    
    // Optimize exponential calculation - high ALU intensity
    let density_thickness = 1.5 * thickness;
    let one_minus_diffuse = 1.0 - diffuseColor;
    let transmittance = exp(-density_thickness * one_minus_diffuse);
    let refractionColor = bgColor * transmittance;
    
    // Fast Fresnel approximation - efficient on M1
    let fresnel_factor = pow(1.0 - n_dot_v, 5.0);
    let fresnel = clamp(0.02 + (0.98 * fresnel_factor), 0.0, 1.0);
    
    // Reflection calculation - minimize matrix multiplication overhead
    let reflectionDir = reflect(rayDir, normal);
    let reflectionDirWorld = (inv_view * vec4f(reflectionDir, 0.0)).xyz;
    
    // Single texture sample - minimize texture access
    let reflectionColor = textureSampleLevel(envmap_texture, texture_sampler, reflectionDirWorld, 0.0).rgb;
    
    // Final color blend - high ALU efficiency
    let finalColor = specular + mix(refractionColor, reflectionColor, fresnel);
    
    return vec4f(finalColor, 1.0);
}