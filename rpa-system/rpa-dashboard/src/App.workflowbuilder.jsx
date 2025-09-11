import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ReactFlowProvider } from 'reactflow';
import WorkflowPage from './components/WorkflowBuilder/WorkflowPage';
import { AuthProvider } from './utils/AuthContext';
import { ToastProvider } from './components/WorkflowBuilder/Toast';
import ErrorBoundary from './components/WorkflowBuilder/ErrorBoundary';
import './index.css';

function App() {
  React.useEffect(() => {
    document.title = "EasyFlow - Workflow Builder";
  }, []);

  return (
    <ErrorBoundary
      title="Workflow Builder Error"
      message="Something went wrong with the workflow builder. Please try refreshing the page."
    >
      <AuthProvider>
        <ToastProvider>
          <ReactFlowProvider>
            <Router>
              <div className="App">
                <Routes>
                  <Route path="/workflows/:workflowId/*" element={<WorkflowPage />} />
                  <Route path="/workflows/*" element={<WorkflowPage />} />
                  <Route path="/*" element={<WorkflowPage />} />
                </Routes>
              </div>
            </Router>
          </ReactFlowProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;