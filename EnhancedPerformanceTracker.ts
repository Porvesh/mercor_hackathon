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
  
  // Long-term tracking
  private longTermFpsCount: number = 0;
  private longTermSimTimeSum: number = 0;
  private longTermRenderTimeSum: number = 0;
  private sessionStartTime: number = performance.now();
  
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
    this.sessionStartTime = performance.now();
    
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
    container.style.backgroundColor = 'rgba(35, 35, 35, 0.9)';
    container.style.color = 'white';
    container.style.padding = '10px';
    container.style.borderRadius = '5px';
    container.style.fontFamily = 'monospace';
    container.style.fontSize = '14px';
    container.style.zIndex = '1000';
    container.style.width = '360px';
    container.style.cursor = 'move'; // Show move cursor
    container.style.userSelect = 'none'; // Prevent text selection during drag
    container.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
    
    // Add a header with title and minimize button
    const headerDiv = document.createElement('div');
    headerDiv.id = 'performance-stats-header';
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
    
    // Add buttons container for multiple controls
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.gap = '5px';
    
    // Add tab buttons for current vs average stats
    const tabsContainer = document.createElement('div');
    tabsContainer.style.display = 'flex';
    tabsContainer.style.border = '1px solid rgba(255,255,255,0.3)';
    tabsContainer.style.borderRadius = '3px';
    tabsContainer.style.marginRight = '5px';
    
    const currentTabBtn = document.createElement('button');
    currentTabBtn.id = 'current-stats-tab';
    currentTabBtn.textContent = 'Current';
    currentTabBtn.style.background = 'rgba(255,255,255,0.2)';
    currentTabBtn.style.border = 'none';
    currentTabBtn.style.color = 'white';
    currentTabBtn.style.padding = '3px 6px';
    currentTabBtn.style.fontSize = '12px';
    currentTabBtn.style.cursor = 'pointer';
    
    const avgTabBtn = document.createElement('button');
    avgTabBtn.id = 'average-stats-tab';
    avgTabBtn.textContent = 'Average';
    avgTabBtn.style.background = 'transparent';
    avgTabBtn.style.border = 'none';
    avgTabBtn.style.color = 'white';
    avgTabBtn.style.padding = '3px 6px';
    avgTabBtn.style.fontSize = '12px';
    avgTabBtn.style.cursor = 'pointer';
    
    tabsContainer.appendChild(currentTabBtn);
    tabsContainer.appendChild(avgTabBtn);
    buttonsContainer.appendChild(tabsContainer);
    
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
    
    buttonsContainer.appendChild(toggleButton);
    headerDiv.appendChild(buttonsContainer);
    
    // Create content divs that can be toggled
    const contentContainer = document.createElement('div');
    contentContainer.id = 'performance-stats-content-container';
    
    const currentStatsDiv = document.createElement('div');
    currentStatsDiv.id = 'current-stats-content';
    
    const avgStatsDiv = document.createElement('div');
    avgStatsDiv.id = 'average-stats-content';
    avgStatsDiv.style.display = 'none';
    
    contentContainer.appendChild(currentStatsDiv);
    contentContainer.appendChild(avgStatsDiv);
    
    // Tab switching functionality
    currentTabBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent drag
      currentTabBtn.style.background = 'rgba(255,255,255,0.2)';
      avgTabBtn.style.background = 'transparent';
      currentStatsDiv.style.display = 'block';
      avgStatsDiv.style.display = 'none';
    });
    
    avgTabBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent drag
      currentTabBtn.style.background = 'transparent';
      avgTabBtn.style.background = 'rgba(255,255,255,0.2)';
      currentStatsDiv.style.display = 'none';
      avgStatsDiv.style.display = 'block';
    });
    
    // Toggle functionality
    let isCollapsed = false;
    toggleButton.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent drag from starting
      isCollapsed = !isCollapsed;
      contentContainer.style.display = isCollapsed ? 'none' : 'block';
      toggleButton.textContent = isCollapsed ? '+' : '-';
      container.style.width = isCollapsed ? 'auto' : '360px';
    });
    
    container.appendChild(headerDiv);
    container.appendChild(contentContainer);
    
    document.body.appendChild(container);
  }
  
  /**
   * Make an element draggable
   */
  private makeDraggable(element: HTMLElement): void {
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;
    
    // Only make the header draggable
    const header = document.getElementById('performance-stats-header');
    if (!header) return;
    
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
    header.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Also handle touch events for mobile
    header.addEventListener('touchstart', (e: TouchEvent) => {
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
    
    // Update long-term averages with every frame
    this.longTermFpsCount++;
    this.longTermSimTimeSum += simulationTime;
    this.longTermRenderTimeSum += renderTime;
    
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
      
      // Update the stats displays
      this.updateCurrentStatsDisplay(fps, avgSimulationTime, avgRenderTime, particlesPerSecond, numParticles);
      this.updateAverageStatsDisplay(numParticles);
      
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
    this.sessionStartTime = performance.now();
    
    // Reset long-term averages
    this.longTermFpsCount = 0;
    this.longTermSimTimeSum = 0;
    this.longTermRenderTimeSum = 0;
    
    // Clear histories
    this.fpsHistory = [];
    this.simTimeHistory = [];
    this.renderTimeHistory = [];
    this.particlesPerSecondHistory = [];
    
    // Clear the displays
    const currentStatsContent = document.getElementById('current-stats-content');
    const averageStatsContent = document.getElementById('average-stats-content');
    
    const loadingMessage = '<div style="text-align: center; padding: 20px;">Collecting data...</div>';
    
    if (currentStatsContent) {
      currentStatsContent.innerHTML = loadingMessage;
    }
    
    if (averageStatsContent) {
      averageStatsContent.innerHTML = loadingMessage;
    }
  }
  
  /**
   * Update the display for current performance statistics
   */
  private updateCurrentStatsDisplay(fps: number, simulationTime: number, renderTime: number, particlesPerSecond: number, numParticles: number): void {
    const totalTime = simulationTime + renderTime;
    
    // Calculate trend indicators
    const fpsIndicator = this.getTrendIndicator(this.fpsHistory, 5);
    const simTimeIndicator = this.getTrendIndicator(this.simTimeHistory, 5, true);
    const renderTimeIndicator = this.getTrendIndicator(this.renderTimeHistory, 5, true);
    
    // Format for friendly display (millions of particles per second)
    const mParticlesPerSecond = (particlesPerSecond / 1_000_000).toFixed(2);
    
    const contentDiv = document.getElementById('current-stats-content');
    if (contentDiv) {
      contentDiv.innerHTML = `
        <div style="font-size: 12px; margin-bottom: 5px; color: #aaa;">Current metrics (last ${(this.updateInterval/1000).toFixed(1)}s)</div>
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 5px;">
          <div title="Frames per second - higher is better">FPS:</div>
          <div style="text-align: right;">${fps.toFixed(1)} ${fpsIndicator}</div>
          
          <div title="Total number of particles in the simulation">Particles:</div>
          <div style="text-align: right;">${numParticles.toLocaleString()}</div>
          
          <div title="Time spent on physics calculations per frame - lower is better">Sim Time:</div>
          <div style="text-align: right;">${simulationTime.toFixed(2)}ms ${simTimeIndicator}</div>
          
          <div title="Time spent on rendering per frame - lower is better">Render Time:</div>
          <div style="text-align: right;">${renderTime.toFixed(2)}ms ${renderTimeIndicator}</div>
          
          <div title="Total processing time per frame - lower is better">Total Time:</div>
          <div style="text-align: right;">${totalTime.toFixed(2)}ms</div>
          
          <div title="Millions of particles processed per second - higher is better">M Particles/s:</div>
          <div style="text-align: right;">${mParticlesPerSecond}</div>
        </div>
      `;
    }
  }
  
  /**
   * Update the display for average performance statistics with corrected calculations
   */
  private updateAverageStatsDisplay(numParticles: number): void {
    const currentTime = performance.now();
    const sessionDuration = (currentTime - this.sessionStartTime) / 1000; // in seconds
    
    // Calculate FPS directly from total frames and elapsed time
    const actualAvgFps = this.longTermFpsCount / Math.max(1, sessionDuration);
    
    // Calculate averages for simulation and render times
    const avgSimTime = this.longTermSimTimeSum / Math.max(1, this.longTermFpsCount);
    const avgRenderTime = this.longTermRenderTimeSum / Math.max(1, this.longTermFpsCount);
    const avgTotalTime = avgSimTime + avgRenderTime;
    
    // Calculate particles per second based on actual FPS
    const avgParticlesPerSecond = numParticles * actualAvgFps;
    
    // Format duration as minutes:seconds
    const minutes = Math.floor(sessionDuration / 60);
    const seconds = Math.floor(sessionDuration % 60);
    const durationString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    const contentDiv = document.getElementById('average-stats-content');
    if (contentDiv) {
      contentDiv.innerHTML = `
        <div style="font-size: 12px; margin-bottom: 5px; color: #aaa;">Average metrics over session (${durationString})</div>
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 5px;">
          <div title="Average frames per second during this session">Avg FPS:</div>
          <div style="text-align: right;">${actualAvgFps.toFixed(1)}</div>
          
          <div title="Total number of particles in the simulation">Particles:</div>
          <div style="text-align: right;">${numParticles.toLocaleString()}</div>
          
          <div title="Average simulation time per frame">Avg Sim Time:</div>
          <div style="text-align: right;">${avgSimTime.toFixed(2)}ms</div>
          
          <div title="Average rendering time per frame">Avg Render Time:</div>
          <div style="text-align: right;">${avgRenderTime.toFixed(2)}ms</div>
          
          <div title="Average total processing time per frame">Avg Total Time:</div>
          <div style="text-align: right;">${avgTotalTime.toFixed(2)}ms</div>
          
          <div title="Average millions of particles processed per second">Avg M Particles/s:</div>
          <div style="text-align: right;">${(avgParticlesPerSecond / 1_000_000).toFixed(2)}</div>
          
          <div title="Total frames processed during this session">Total Frames:</div>
          <div style="text-align: right;">${this.longTermFpsCount.toLocaleString()}</div>
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