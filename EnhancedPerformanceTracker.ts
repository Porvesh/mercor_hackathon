import { PerformanceTracker } from './performance';

// Extend the PerformanceTracker class to add statistics display functionality
export class EnhancedPerformanceTracker extends PerformanceTracker {
  private statsElement: HTMLElement;
  private updateInterval: number = 3000; // Update stats every 3 seconds
  private lastUpdateTime: number = 0;
  private frameCount: number = 0;
  
  // Performance metrics histories for trend analysis
  private fpsHistory: number[] = [];
  private simTimeHistory: number[] = [];
  private renderTimeHistory: number[] = [];
  private particlesPerSecondHistory: number[] = [];
  
  // Maximum history length to keep
  private readonly MAX_HISTORY_LENGTH = 60; // Keep last minute of stats (at 3s intervals)
  
  constructor() {
    super();
    
    // Create stats container if it doesn't exist
    if (!document.getElementById('performance-stats')) {
      this.createStatsContainer();
    }
    
    this.statsElement = document.getElementById('performance-stats')!;
    this.lastUpdateTime = performance.now();
    
    // Make the stats container draggable
    this.makeDraggable(this.statsElement);
  }
  
  private createStatsContainer() {
    // Create container for performance stats
    const container = document.createElement('div');
    container.id = 'performance-stats';
    container.style.position = 'absolute';
    container.style.top = '10px';
    container.style.right = '10px';
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    container.style.color = 'white';
    container.style.padding = '10px';
    container.style.borderRadius = '5px';
    container.style.fontFamily = 'monospace';
    container.style.fontSize = '14px';
    container.style.zIndex = '1000';
    container.style.width = '300px';
    container.style.cursor = 'move'; // Show move cursor
    container.style.userSelect = 'none'; // Prevent text selection during drag
    container.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
    
    // Add a header with title and minimize button
    const headerDiv = document.createElement('div');
    headerDiv.style.display = 'flex';
    headerDiv.style.justifyContent = 'space-between';
    headerDiv.style.alignItems = 'center';
    headerDiv.style.marginBottom = '8px';
    headerDiv.style.borderBottom = '1px solid rgba(255,255,255,0.2)';
    headerDiv.style.paddingBottom = '5px';
    
    const titleSpan = document.createElement('span');
    titleSpan.textContent = 'Performance Stats';
    titleSpan.style.fontWeight = 'bold';
    titleSpan.style.fontSize = '16px';
    headerDiv.appendChild(titleSpan);
    
    // Add toggle button
    const toggleButton = document.createElement('button');
    toggleButton.textContent = '-';
    toggleButton.style.background = 'transparent';
    toggleButton.style.border = '1px solid rgba(255,255,255,0.3)';
    toggleButton.style.color = 'white';
    toggleButton.style.width = '24px';
    toggleButton.style.height = '24px';
    toggleButton.style.borderRadius = '3px';
    toggleButton.style.cursor = 'pointer';
    toggleButton.style.display = 'flex';
    toggleButton.style.justifyContent = 'center';
    toggleButton.style.alignItems = 'center';
    toggleButton.style.fontSize = '16px';
    toggleButton.style.padding = '0';
    
    // Create content div that can be toggled
    const contentDiv = document.createElement('div');
    contentDiv.id = 'performance-stats-content';
    
    // Toggle functionality
    let isCollapsed = false;
    toggleButton.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent drag from starting
      isCollapsed = !isCollapsed;
      contentDiv.style.display = isCollapsed ? 'none' : 'block';
      toggleButton.textContent = isCollapsed ? '+' : '-';
      container.style.width = isCollapsed ? 'auto' : '300px';
    });
    
    headerDiv.appendChild(toggleButton);
    container.appendChild(headerDiv);
    container.appendChild(contentDiv);
    
    document.body.appendChild(container);
  }
  
  /**
   * Make an element draggable
   */
  private makeDraggable(element: HTMLElement): void {
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;
    
    // Handle start of drag
    const handleMouseDown = (e: MouseEvent) => {
      if (e.target instanceof HTMLButtonElement) {
        return; // Don't start drag if clicking on a button
      }
      
      isDragging = true;
      offsetX = e.clientX - element.getBoundingClientRect().left;
      offsetY = e.clientY - element.getBoundingClientRect().top;
      
      // Add a temporary overlay to prevent interference with other elements
      const overlay = document.createElement('div');
      overlay.id = 'drag-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.zIndex = '999';
      overlay.style.cursor = 'move';
      document.body.appendChild(overlay);
      
      // Ensure our element is above the overlay
      element.style.zIndex = '1001';
    };
    
    // Handle drag
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      // Calculate new position with boundaries to keep in viewport
      const newLeft = Math.max(0, Math.min(window.innerWidth - element.offsetWidth, e.clientX - offsetX));
      const newTop = Math.max(0, Math.min(window.innerHeight - element.offsetHeight, e.clientY - offsetY));
      
      // Update position
      element.style.left = `${newLeft}px`;
      element.style.top = `${newTop}px`;
      element.style.right = 'auto'; // Clear any right positioning
    };
    
    // Handle end of drag
    const handleMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        
        // Remove the overlay
        const overlay = document.getElementById('drag-overlay');
        if (overlay) {
          document.body.removeChild(overlay);
        }
        
        // Reset z-index
        element.style.zIndex = '1000';
      }
    };
    
    // Add event listeners
    element.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Also handle touch events for mobile
    element.addEventListener('touchstart', (e: TouchEvent) => {
      const touch = e.touches[0];
      handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent);
    });
    
    document.addEventListener('touchmove', (e: TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent);
    });
    
    document.addEventListener('touchend', handleMouseUp);
  }
  
  /**
   * Override the parent update method to track statistics and update display
   */
  update(simulationTime: number, renderTime: number, numParticles: number): void {
    // Call the parent class update method
    super.update(simulationTime, renderTime, numParticles);
    
    const currentTime = performance.now();
    this.frameCount++;
    
    // Update stats every few seconds
    if (currentTime - this.lastUpdateTime >= this.updateInterval) {
      const elapsed = (currentTime - this.lastUpdateTime) / 1000; // Convert to seconds
      const fps = this.frameCount / elapsed;
      
      // Get averages from the parent class methods
      const avgSimulationTime = super.getAverageSimulationTime();
      const avgRenderTime = super.getAverageRenderTime();
      
      // Calculate particles processed per second
      const particlesPerSecond = numParticles * fps;
      
      // Add to history
      this.fpsHistory.push(fps);
      this.simTimeHistory.push(avgSimulationTime);
      this.renderTimeHistory.push(avgRenderTime);
      this.particlesPerSecondHistory.push(particlesPerSecond);
      
      // Limit history length
      if (this.fpsHistory.length > this.MAX_HISTORY_LENGTH) {
        this.fpsHistory.shift();
        this.simTimeHistory.shift();
        this.renderTimeHistory.shift();
        this.particlesPerSecondHistory.shift();
      }
      
      // Update the stats display
      this.updateStatsDisplay(fps, avgSimulationTime, avgRenderTime, particlesPerSecond, numParticles);
      
      // Reset counters
      this.frameCount = 0;
      this.lastUpdateTime = currentTime;
    }
  }
  
  /**
   * Override reset to also clear our tracking data
   */
  override reset(): void {
    // Call parent class reset
    super.reset();
    
    // Reset our tracking data
    this.frameCount = 0;
    this.lastUpdateTime = performance.now();
    
    // Clear histories
    this.fpsHistory = [];
    this.simTimeHistory = [];
    this.renderTimeHistory = [];
    this.particlesPerSecondHistory = [];
    
    // Clear the display
    const contentDiv = document.getElementById('performance-stats-content');
    if (contentDiv) {
      contentDiv.innerHTML = '<div style="text-align: center; padding: 20px;">Collecting data...</div>';
    }
  }
  
  private updateStatsDisplay(fps: number, simulationTime: number, renderTime: number, particlesPerSecond: number, numParticles: number): void {
    const totalTime = simulationTime + renderTime;
    
    // Calculate trend indicators
    const fpsIndicator = this.getTrendIndicator(this.fpsHistory, 5);
    const simTimeIndicator = this.getTrendIndicator(this.simTimeHistory, 5, true);
    const renderTimeIndicator = this.getTrendIndicator(this.renderTimeHistory, 5, true);
    
    // Format for friendly display (millions of particles per second)
    const mParticlesPerSecond = (particlesPerSecond / 1_000_000).toFixed(2);
    
    const contentDiv = document.getElementById('performance-stats-content');
    if (contentDiv) {
      contentDiv.innerHTML = `
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 5px;">
          <div>FPS:</div>
          <div style="text-align: right;">${fps.toFixed(1)} ${fpsIndicator}</div>
          
          <div>Particles:</div>
          <div style="text-align: right;">${numParticles.toLocaleString()}</div>
          
          <div>Sim Time:</div>
          <div style="text-align: right;">${simulationTime.toFixed(2)}ms ${simTimeIndicator}</div>
          
          <div>Render Time:</div>
          <div style="text-align: right;">${renderTime.toFixed(2)}ms ${renderTimeIndicator}</div>
          
          <div>Total Time:</div>
          <div style="text-align: right;">${totalTime.toFixed(2)}ms</div>
          
          <div>M Particles/s:</div>
          <div style="text-align: right;">${mParticlesPerSecond}</div>
        </div>
      `;
    }
  }
  
  private getTrendIndicator(history: number[], lookback: number = 5, inverted: boolean = false): string {
    if (history.length < lookback + 1) return "";
    
    const current = history[history.length - 1];
    const previous = history[history.length - 1 - lookback];
    const percentChange = ((current - previous) / previous) * 100;
    
    // For metrics where lower is better (like times), invert the direction
    const actualChange = inverted ? -percentChange : percentChange;
    
    if (Math.abs(actualChange) < 5) return ""; // No significant change
    
    if (actualChange > 0) {
      return `<span style="color: #4CAF50;">↑</span>`;
    } else {
      return `<span style="color: #F44336;">↓</span>`;
    }
  }
}