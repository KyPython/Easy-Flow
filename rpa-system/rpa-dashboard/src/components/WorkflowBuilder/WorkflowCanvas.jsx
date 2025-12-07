import React, { useCallback, useMemo, useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import styles from './WorkflowCanvas.module.css';
import CustomNode from './CustomNode';
// PERFORMANCE OPTIMIZATION: Use lazy-loaded StepConfigPanel to reduce initial bundle size
// This reduces the main bundle by ~1,139 lines of code and improves initial load time
import { StepConfigPanel } from '../LazyLoader';
import { useWorkflow } from '../../hooks/useWorkflow';

// Define custom node & edge types at module scope to keep identity stable across renders
const NODE_TYPES = {
  customStep: CustomNode,
};

const EDGE_TYPES = {
  // add custom edge components here if needed, e.g., "smoothstep": CustomEdge
};

// Default edge style matching theme
const defaultEdgeOptions = {
  animated: true,
  style: {
    stroke: 'var(--color-primary-600)',
    strokeWidth: 2,
  },
};

// Stable React Flow pro options (avoid recreating objects per render)
const PRO_OPTIONS = Object.freeze({ hideAttribution: true });

const WorkflowCanvas = forwardRef(({ workflowId, isReadOnly = false }, ref) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false); // ✅ UX: Track auto-save status
  const [dismissedGuidance, setDismissedGuidance] = useState({}); // ✅ UX: Track dismissed guidance messages
  const [lastGuidanceKey, setLastGuidanceKey] = useState(null); // ✅ FIX: Track last guidance key to detect changes
  
  const { fitView, getViewport } = useReactFlow();
  // track whether we've applied the initial fitView so we don't re-center on subsequent updates
  const initialFitRef = useRef(false);
  // ✅ FIX: Track if we've already checked/added Start step to prevent infinite loop
  const startStepCheckedRef = useRef(false);
  const { workflow, updateWorkflow, saveWorkflow } = useWorkflow(workflowId);

  // Use stable module-level types to avoid React Flow warnings about changing objects
  // Memoize node/edge types to ensure stable identity across renders
  const memoizedNodeTypes = useMemo(() => NODE_TYPES, []);
  const memoizedEdgeTypes = useMemo(() => EDGE_TYPES, []);
  // Load workflow data
  useEffect(() => {
    if (workflow && workflow.canvas_config) {
      const { nodes: savedNodes, edges: savedEdges, viewport } = workflow.canvas_config;
      
      if (savedNodes) {
        setNodes(savedNodes.map(node => ({
          ...node,
          type: 'customStep',
          data: {
            // ensure data object exists and has safe defaults
            label: 'Step',
            isConfigured: false,
            isRunning: false,
            hasError: false,
            progress: undefined,
            isReadOnly: false,
            ...(node.data || {}),
            // coerce stepType to string when present
            stepType: typeof node?.data?.stepType === 'string' ? node.data.stepType : (node?.data?.stepType ? String(node.data.stepType) : 'unknown')
          }
        })));
      }
      
      if (savedEdges) {
        setEdges(savedEdges);
      }
      
      if (viewport && !initialFitRef.current) {
        // Only fit view the first time we load a viewport from the saved workflow.
        // Subsequent changes (user pans/zooms) should not be overridden.
        try {
          fitView({ duration: 200 });
        } catch (err) {
          // swallow; fitView may not be ready synchronously in some versions
          console.debug('fitView failed during initial load', err);
        }
        initialFitRef.current = true;
      }
    } else if (workflow && !workflow.canvas_config && !startStepCheckedRef.current) {
      // ✅ UX: Auto-add Start step for existing workflows that don't have one (only once)
      const hasStartStep = nodes.some(node => 
        node.data?.stepType === 'start' || node.data?.stepType === 'trigger'
      );
      
      if (!hasStartStep && nodes.length === 0) {
        const startNode = {
          id: `node-start-${Date.now()}`,
          type: 'customStep',
          position: { x: 100, y: 100 },
          data: {
            label: 'Start',
            stepType: 'start',
            isConfigured: true,
          },
        };
        setNodes([startNode]);
        startStepCheckedRef.current = true; // Mark as checked to prevent re-triggering
      } else {
        startStepCheckedRef.current = true; // Mark as checked even if Start step exists
      }
    } else if (workflow && workflow.canvas_config && nodes.length > 0 && !startStepCheckedRef.current) {
      // ✅ UX: Check if existing workflow is missing Start step and add it (only once)
      const hasStartStep = nodes.some(node => 
        node.data?.stepType === 'start' || node.data?.stepType === 'trigger'
      );
      
      if (!hasStartStep) {
        // Find the leftmost node to place Start step to its left
        const leftmostNode = nodes.reduce((leftmost, node) => 
          !leftmost || node.position.x < leftmost.position.x ? node : leftmost
        );
        
        const startNode = {
          id: `node-start-${Date.now()}`,
          type: 'customStep',
          position: { 
            x: Math.max(0, leftmostNode.position.x - 200), 
            y: leftmostNode.position.y 
          },
          data: {
            label: 'Start',
            stepType: 'start',
            isConfigured: true,
          },
        };
        setNodes(prev => [startNode, ...prev]);
        startStepCheckedRef.current = true; // Mark as checked to prevent re-triggering
      } else {
        startStepCheckedRef.current = true; // Mark as checked even if Start step exists
      }
    }
    setIsLoading(false);
  }, [workflow, setNodes, setEdges, fitView]); // ✅ FIX: Removed 'nodes' from dependencies to prevent infinite loop

  // ✅ OBSERVABILITY: Track save attempts for debugging
  const saveAttemptsRef = useRef(0);
  
  // Auto-save canvas state
  const saveCanvasState = useCallback(async () => {
    // ✅ FIX: Only save if workflow exists (has been saved at least once)
    if (isReadOnly || !workflow || !workflow.id) {
      // Silently skip if workflow doesn't exist yet (user needs to click Save first)
      return;
    }
    
    saveAttemptsRef.current += 1;
    const viewport = getViewport();
    const canvasConfig = {
      nodes,
      edges,
      viewport
    };
    
    setIsSaving(true);
    try {
      await updateWorkflow({
        canvas_config: canvasConfig
      });
      // ✅ UX: Log successful saves (only in dev to avoid noise)
      if (process.env.NODE_ENV === 'development') {
        console.debug(`✅ Auto-saved canvas state (attempt ${saveAttemptsRef.current})`);
      }
    } catch (error) {
      console.error('Failed to save canvas state:', error);
      // ✅ OBSERVABILITY: Log save failures for debugging
      console.error('Save attempt:', saveAttemptsRef.current, 'Workflow ID:', workflow?.id);
    } finally {
      // ✅ UX: Add small delay before hiding "Saving..." to show feedback
      setTimeout(() => setIsSaving(false), 300);
    }
  }, [nodes, edges, getViewport, updateWorkflow, workflow?.id, isReadOnly, workflow]);

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    getCurrentCanvasState: () => ({
      nodes,
      edges,
      viewport: getViewport()
    }),
    saveCanvasState
  }), [nodes, edges, getViewport, saveCanvasState]);

  // ✅ Debounced auto-save (only for existing workflows)
  useEffect(() => {
    // Skip if no workflow exists yet (user needs to click Save first)
    if (!workflow || !workflow.id) {
      return;
    }
    
    // Skip if canvas is empty (nothing to save)
    if (nodes.length === 0 && edges.length === 0) {
      return;
    }
    
    // ✅ UX: Debounce saves to avoid excessive API calls (1 second delay)
    const timeout = setTimeout(() => {
      saveCanvasState();
    }, 1000);
    
    return () => clearTimeout(timeout);
  }, [nodes, edges, saveCanvasState, workflow?.id]);

  // ✅ FIX: Reset dismissed guidance when workflow state changes (real-time updates)
  useEffect(() => {
    if (nodes.length === 0) {
      setLastGuidanceKey(null);
      return;
    }
    
    const hasStartStep = nodes.some(node => 
      node.data?.stepType === 'start' || node.data?.stepType === 'trigger'
    );
    const hasConnections = edges.length > 0;
    const actionSteps = nodes.filter(node => 
      node.data?.stepType !== 'start' && node.data?.stepType !== 'end'
    );
    
    const currentGuidanceKey = !hasStartStep && actionSteps.length > 0 
      ? 'missing_start' 
      : hasStartStep && actionSteps.length > 0 && !hasConnections 
      ? 'missing_connections' 
      : null;
    
    // If guidance key changed OR became null (workflow is complete), clear dismissed state
    if (currentGuidanceKey !== lastGuidanceKey) {
      if (lastGuidanceKey !== null) {
        // Clear dismissed state for the old key
        setDismissedGuidance(prev => {
          const updated = { ...prev };
          delete updated[lastGuidanceKey];
          return updated;
        });
      }
      // If workflow is now complete (no guidance needed), clear all dismissed states
      if (currentGuidanceKey === null) {
        setDismissedGuidance({});
      }
    }
    
    setLastGuidanceKey(currentGuidanceKey);
  }, [nodes, edges, lastGuidanceKey]);

  // Handle connections between nodes
  const onConnect = useCallback(
    (params) => {
      if (isReadOnly) return;
      
      const newEdge = {
        ...params,
        id: `edge-${Date.now()}`,
        animated: true,
        style: defaultEdgeOptions.style,
      };
      
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges, isReadOnly]
  );

  // Handle node selection
  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
    setShowConfigPanel(true);
  }, []);

  // Handle node drag end
  const onNodeDragStop = useCallback((event, node) => {
    if (isReadOnly) return;
    // Auto-save is handled by the debounced effect above
  }, [isReadOnly]);

  // Add new node to canvas
  const addNode = useCallback((nodeType, position = null) => {
    if (isReadOnly) return;
    
    const canvasRect = document.querySelector('.react-flow__viewport')?.getBoundingClientRect();
    const defaultPosition = position || {
      x: Math.random() * 300,
      y: Math.random() * 300,
    };

    const newNode = {
      id: `node-${Date.now()}`,
      type: 'customStep',
      position: defaultPosition,
      data: {
        label: getNodeLabel(nodeType),
        stepType: nodeType,
        actionType: getDefaultActionType(nodeType),
        config: getDefaultConfig(nodeType),
        isConfigured: false,
      },
    };

    setNodes((nds) => nds.concat(newNode));
  }, [setNodes, isReadOnly]);

  // Delete selected node
  const deleteNode = useCallback((nodeId) => {
    if (isReadOnly) return;
    
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => 
      edge.source !== nodeId && edge.target !== nodeId
    ));
    
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
      setShowConfigPanel(false);
    }
  }, [setNodes, setEdges, selectedNode, isReadOnly]);

  // Update node configuration
  const updateNodeConfig = useCallback((nodeId, config) => {
    if (isReadOnly) return;
    
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                config,
                isConfigured: true,
              },
            }
          : node
      )
    );
  }, [setNodes, isReadOnly]);

  // Toolbar actions
  const toolbarItems = useMemo(() => [
    {
      id: 'start',
      label: 'Start',
      icon: '🎬',
      description: 'Workflow entry point',
      category: 'control'
    },
    {
      id: 'web_scrape',
      label: 'Web Scraping',
      icon: '🌐',
      description: 'Extract data from websites',
      category: 'data'
    },
    {
      id: 'api_call',
      label: 'API Request',
      icon: '🔗',
      description: 'Make HTTP requests',
      category: 'integration'
    },
    {
      id: 'data_transform',
      label: 'Transform Data',
      icon: '🔄',
      description: 'Process and transform data',
      category: 'data'
    },
    {
      id: 'condition',
      label: 'Condition',
      icon: '❓',
      description: 'Branch workflow logic',
      category: 'control'
    },
    {
      id: 'email',
      label: 'Send Email',
      icon: '📧',
      description: 'Send notifications',
      category: 'communication'
    },
    {
      id: 'file_upload',
      label: 'Upload File',
      icon: '📁',
      description: 'Store files',
      category: 'storage'
    },
    {
      id: 'delay',
      label: 'Delay',
      icon: '⏰',
      description: 'Wait for specified time',
      category: 'utility'
    },
    {
      id: 'end',
      label: 'End',
      icon: '🏁',
      description: 'Workflow completion',
      category: 'control'
    }
  ], []);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading workflow...</p>
      </div>
    );
  }

  return (
    <div className={styles.workflowCanvas}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={memoizedNodeTypes}
        edgeTypes={memoizedEdgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        proOptions={PRO_OPTIONS}
        fitView
        className={styles.reactFlow}
      >
        <Controls className={styles.controls} />
        <MiniMap 
          className={styles.minimap}
          nodeColor={(node) => getNodeColor(node?.data?.stepType || 'unknown')}
          maskColor="var(--color-gray-900)"
          maskOpacity={0.1}
        />
        <Background color="var(--color-primary-100)" gap={20} />
        
        {/* Empty State */}
        {nodes.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateContent}>
              <h3>🚀 Start Building Your Workflow</h3>
              <p>Your workflow already has a Start step! Now add action steps from the toolbar.</p>
              <div className={styles.emptyStateIcon}>✨</div>
              <div className={styles.emptyStateQuickStart}>
                <strong>Quick Start:</strong>
                <ol className={styles.emptyStateList}>
                  <li>Click an action (🌐 Web Scraping, 📧 Send Email, etc.)</li>
                  <li>Connect the Start step to your action</li>
                  <li>Click "🎬 Start" to run!</li>
                </ol>
              </div>
            </div>
          </div>
        )}
        
        {/* ✅ UX: Show helpful guidance as floating notification (non-blocking) */}
        {nodes.length > 0 && (() => {
          // ✅ FIX: More robust Start step detection - check stepType, label, and id
          const hasStartStep = nodes.some(node => {
            const stepType = node.data?.stepType;
            const label = node.data?.label?.toLowerCase();
            const id = node.id?.toLowerCase();
            const isStart = stepType === 'start' || 
                           stepType === 'trigger' ||
                           label === 'start' ||
                           id?.includes('start');
            // Debug logging in development
            if (process.env.NODE_ENV === 'development' && isStart) {
              console.debug('[Guidance] Found Start step:', { stepType, label, id, node });
            }
            return isStart;
          });
          const hasConnections = edges.length > 0;
          const actionSteps = nodes.filter(node => {
            const stepType = node.data?.stepType;
            return stepType !== 'start' && 
                   stepType !== 'trigger' && 
                   stepType !== 'end';
          });
          
          // ✅ FIX: Only show guidance if workflow is actually incomplete
          // If workflow has Start + connections, don't show any guidance
          if (hasStartStep && hasConnections) {
            // Debug logging in development
            if (process.env.NODE_ENV === 'development') {
              console.debug('[Guidance] Workflow complete - hiding guidance', { 
                hasStartStep, 
                hasConnections, 
                nodesCount: nodes.length, 
                edgesCount: edges.length 
              });
            }
            return null; // Workflow is complete, no guidance needed
          }
          
          // Check if guidance was dismissed
          const guidanceKey = !hasStartStep && actionSteps.length > 0 
            ? 'missing_start' 
            : hasStartStep && actionSteps.length > 0 && !hasConnections 
            ? 'missing_connections' 
            : null;
          
          // Debug logging in development
          if (process.env.NODE_ENV === 'development' && guidanceKey) {
            console.debug('[Guidance] Showing guidance', { 
              guidanceKey, 
              hasStartStep, 
              hasConnections, 
              actionStepsCount: actionSteps.length,
              nodes: nodes.map(n => ({ id: n.id, stepType: n.data?.stepType, label: n.data?.label })),
              dismissed: dismissedGuidance[guidanceKey]
            });
          }
          
          if (!guidanceKey || dismissedGuidance[guidanceKey]) {
            return null;
          }
          
          const guidanceContent = !hasStartStep && actionSteps.length > 0 ? {
            title: '💡 Missing Start Step!',
            message: 'Click the "🎬 Start" button in the Actions toolbar, then connect it to your first action step.',
            variant: 'warning'
          } : {
            title: '🔗 Connect Your Steps!',
            message: 'Drag from the Start step to your action step to connect them. All steps need to be connected to run.',
            variant: 'primary'
          };
          
          return (
            <div className={styles.floatingGuidance}>
              <div className={`${styles.floatingGuidanceContent} ${styles[guidanceContent.variant]}`}>
                <div className={styles.guidanceHeader}>
                  <div className={styles.guidanceText}>
                    <strong className={styles.guidanceTitle}>
                      {guidanceContent.title}
                    </strong>
                    <p className={styles.guidanceMessage}>
                      {guidanceContent.message}
                    </p>
                  </div>
                  <button
                    className={styles.guidanceDismiss}
                    onClick={() => setDismissedGuidance(prev => ({ ...prev, [guidanceKey]: true }))}
                    title="Dismiss"
                    aria-label="Dismiss guidance"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
        
        {/* Action Toolbar */}
        {!isReadOnly && (
          <Panel position="top-left" className={styles.toolbar}>
            <div className={styles.toolbarHeader}>
              <h3>Actions</h3>
            </div>
            <div className={styles.toolbarGrid}>
              {toolbarItems.map((item) => (
                <button
                  key={item.id}
                  className={styles.toolbarButton}
                  onClick={() => addNode(item.id)}
                  title={item.description}
                  data-category={item.category}
                >
                  <span className={styles.toolbarIcon}>{item.icon}</span>
                  <span className={styles.toolbarLabel}>{item.label}</span>
                </button>
              ))}
            </div>
          </Panel>
        )}

        {/* Canvas Info */}
        <Panel position="top-right" className={styles.info}>
          <div className={styles.infoItem}>
            <strong>{nodes.length}</strong> steps
          </div>
          <div className={styles.infoItem}>
            <strong>{edges.length}</strong> connections
          </div>
          {workflow?.status && (
            <div className={`${styles.infoItem} ${styles.status}`}>
              <span 
                className={`${styles.statusBadge} ${styles[workflow.status]}`}
              >
                {workflow.status}
              </span>
            </div>
          )}
          {/* ✅ UX: Show auto-save status */}
          {workflow?.id ? (
            <div className={styles.infoItem} style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
              {isSaving ? (
                <span style={{ color: 'var(--color-primary-600)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>💾</span> Saving...
                </span>
              ) : (
                <span style={{ color: 'var(--color-success-600)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ✓ Saved
                </span>
              )}
            </div>
          ) : (
            <div className={styles.infoItem} style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--color-warning-600)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                ⚠️ Click "Save" to enable auto-save
              </span>
            </div>
          )}
        </Panel>
      </ReactFlow>

      {/* Step Configuration Panel */}
      {showConfigPanel && selectedNode && (
        <StepConfigPanel
          node={selectedNode}
          onClose={() => setShowConfigPanel(false)}
          onSave={(config) => updateNodeConfig(selectedNode.id, config)}
          onDelete={() => deleteNode(selectedNode.id)}
          isReadOnly={isReadOnly}
        />
      )}
    </div>
  );
});

WorkflowCanvas.displayName = 'WorkflowCanvas';

// Helper functions
function getNodeLabel(nodeType) {
  const labels = {
    start: 'Start',
    web_scrape: 'Web Scraping',
    api_call: 'API Request',
    data_transform: 'Transform Data',
    condition: 'Condition',
    email: 'Send Email',
    file_upload: 'Upload File',
    delay: 'Delay',
    end: 'End'
  };
  return labels[nodeType] || 'Unknown';
}

function getDefaultActionType(nodeType) {
  return nodeType === 'start' || nodeType === 'end' || nodeType === 'condition' 
    ? null 
    : nodeType;
}

function getDefaultConfig(nodeType) {
  const configs = {
    start: {},
    web_scrape: {
      url: '',
      selectors: [],
  timeout: 30,
  retries: { maxAttempts: 3, baseMs: 300 }
    },
    api_call: {
      method: 'GET',
      url: '',
      headers: {},
  timeout: 30,
  retries: { maxAttempts: 3, baseMs: 300 }
    },
    data_transform: {
      transformations: [],
      output_format: 'json'
    },
    condition: {
      conditions: [],
      operator: 'AND'
    },
    email: {
      to: [],
      subject: '',
      template: ''
    },
    file_upload: {
  destination: '',
  overwrite: false,
  public: false,
  source_field: '',
  url: '',
  filename: '',
  mime_type: '',
  tags: [],
  retries: { maxAttempts: 3, baseMs: 300 }
    },
    delay: {
      duration_seconds: 5,
      duration_type: 'fixed'
    },
    end: {
      success: true,
      message: 'Workflow completed successfully'
    }
  };
  return configs[nodeType] || {};
}

function getNodeColor(stepType) {
  const colors = {
    start: 'var(--color-success-500)',
    end: 'var(--color-error-500)',
    web_scrape: 'var(--color-primary-500)',
    api_call: 'var(--color-secondary-500)',
    data_transform: 'var(--color-warning-500)',
    condition: 'var(--color-secondary-600)',
    email: 'var(--color-primary-400)',
    file_upload: 'var(--color-success-600)',
    delay: 'var(--color-gray-500)',
  };
  return colors[stepType] || 'var(--color-primary-500)';
}

export default WorkflowCanvas;

WorkflowCanvas.propTypes = {
  workflowId: PropTypes.string,
  isReadOnly: PropTypes.bool
};