import React, { useCallback, useMemo, useState, useEffect } from 'react';
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
import StepConfigPanel from './StepConfigPanel';
import { useWorkflow } from '../../hooks/useWorkflow';

// Define custom node types
const nodeTypes = {
  customStep: CustomNode,
};

// Default edge style matching theme
const defaultEdgeOptions = {
  animated: true,
  style: {
    stroke: 'var(--color-primary-600)',
    strokeWidth: 2,
  },
};

const WorkflowCanvas = ({ workflowId, isReadOnly = false }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const { fitView, getViewport } = useReactFlow();
  const { workflow, updateWorkflow, saveWorkflow } = useWorkflow(workflowId);

  // Load workflow data
  useEffect(() => {
    if (workflow && workflow.canvas_config) {
      const { nodes: savedNodes, edges: savedEdges, viewport } = workflow.canvas_config;
      
      if (savedNodes) {
        setNodes(savedNodes.map(node => ({
          ...node,
          type: 'customStep',
        })));
      }
      
      if (savedEdges) {
        setEdges(savedEdges);
      }
      
      if (viewport) {
        fitView({ duration: 200 });
      }
    }
    setIsLoading(false);
  }, [workflow, setNodes, setEdges, fitView]);

  // Auto-save canvas state
  const saveCanvasState = useCallback(async () => {
    if (isReadOnly || !workflow) return;
    
    const viewport = getViewport();
    const canvasConfig = {
      nodes,
      edges,
      viewport
    };
    
    try {
      await updateWorkflow({
        canvas_config: canvasConfig
      });
    } catch (error) {
      console.error('Failed to save canvas state:', error);
    }
  }, [nodes, edges, getViewport, updateWorkflow, workflow, isReadOnly]);

  // Debounced auto-save
  useEffect(() => {
    if (nodes.length === 0 && edges.length === 0) return;
    
    const timeout = setTimeout(saveCanvasState, 1000);
    return () => clearTimeout(timeout);
  }, [nodes, edges, saveCanvasState]);

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
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        attributionPosition="bottom-left"
        className={styles.reactFlow}
      >
        <Controls className={styles.controls} />
        <MiniMap 
          className={styles.minimap}
          nodeColor={(node) => getNodeColor(node.data.stepType)}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
        <Background color="var(--color-primary-100)" gap={20} />
        
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
};

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
      timeout: 30
    },
    api_call: {
      method: 'GET',
      url: '',
      headers: {},
      timeout: 30
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
      public: false
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