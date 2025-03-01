// Implementation for the PerformanceTracker class
export class PerformanceTracker {
    // Stats for overall performance monitoring
    private simulationTimes: number[] = [];
    private renderTimes: number[] = [];
    private totalFrames: number = 0;
    private startTime: number = performance.now();
    
    // Sample size for moving averages
    private readonly SAMPLE_SIZE = 30;
    
    constructor() {
      // Initialize performance tracking
      this.reset();
    }
    
    /**
     * Reset all performance metrics
     */
    reset(): void {
      this.simulationTimes = [];
      this.renderTimes = [];
      this.totalFrames = 0;
      this.startTime = performance.now();
    }
    
    /**
     * Update performance metrics with new frame data
     * @param simulationTime Time taken for simulation in ms
     * @param renderTime Time taken for rendering in ms
     * @param numParticles Current number of particles
     */
    update(simulationTime: number, renderTime: number, numParticles: number): void {
      // Add times to history, keeping only the most recent samples
      this.simulationTimes.push(simulationTime);
      this.renderTimes.push(renderTime);
      
      if (this.simulationTimes.length > this.SAMPLE_SIZE) {
        this.simulationTimes.shift();
        this.renderTimes.shift();
      }
      
      this.totalFrames++;
    }
    
    /**
     * Get the average simulation time over recent frames
     */
    getAverageSimulationTime(): number {
      if (this.simulationTimes.length === 0) return 0;
      
      const sum = this.simulationTimes.reduce((acc, time) => acc + time, 0);
      return sum / this.simulationTimes.length;
    }
    
    /**
     * Get the average render time over recent frames
     */
    getAverageRenderTime(): number {
      if (this.renderTimes.length === 0) return 0;
      
      const sum = this.renderTimes.reduce((acc, time) => acc + time, 0);
      return sum / this.renderTimes.length;
    }
    
    /**
     * Get the overall average FPS since tracking began
     */
    getAverageFPS(): number {
      const elapsedSeconds = (performance.now() - this.startTime) / 1000;
      return this.totalFrames / elapsedSeconds;
    }
    
    /**
     * Get the current FPS calculated from recent frame times
     */
    getCurrentFPS(): number {
      if (this.simulationTimes.length === 0 || this.renderTimes.length === 0) return 0;
      
      // Calculate average frame time from recent samples
      const avgSimTime = this.getAverageSimulationTime();
      const avgRenderTime = this.getAverageRenderTime();
      const avgFrameTime = avgSimTime + avgRenderTime;
      
      // Convert to FPS (1000 ms / frame time in ms)
      return avgFrameTime > 0 ? 1000 / avgFrameTime : 0;
    }
    
    /**
     * Get comprehensive performance statistics
     */
    getStats(): {
      avgSimTime: number,
      avgRenderTime: number,
      avgTotalTime: number,
      currentFPS: number,
      overallFPS: number,
      totalFrames: number,
      elapsedTime: number
    } {
      const avgSimTime = this.getAverageSimulationTime();
      const avgRenderTime = this.getAverageRenderTime();
      
      return {
        avgSimTime,
        avgRenderTime,
        avgTotalTime: avgSimTime + avgRenderTime,
        currentFPS: this.getCurrentFPS(),
        overallFPS: this.getAverageFPS(),
        totalFrames: this.totalFrames,
        elapsedTime: (performance.now() - this.startTime) / 1000
      };
    }
  }