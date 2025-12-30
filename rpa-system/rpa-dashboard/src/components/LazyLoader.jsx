import React, { Suspense } from 'react';

// Performance optimization: Lazy load large components
const LazyStepConfigPanel = React.lazy(() => import('./WorkflowBuilder/StepConfigPanel'));
const LazyTaskForm = React.lazy(() => import('./TaskForm/TaskForm'));
const LazyFileManager = React.lazy(() => import('./FileManager/FileManager'));
const LazySearchSuggestions = React.lazy(() => import('./SearchSuggestions/SearchSuggestions'));

// Loading fallback component
const LoadingFallback = ({ componentName = "component" }) => (
  <div className="loading-container" style={{ 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    minHeight: '200px',
    flexDirection: 'column',
    gap: '10px'
  }}>
    <div className="spinner" style={{
      border: '3px solid #f3f3f3',
      borderTop: '3px solid #007bff',
      borderRadius: '50%',
      width: '30px',
      height: '30px',
      animation: 'spin 1s linear infinite'
    }}></div>
    <p>Loading {componentName}...</p>
    <style>
      {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
    </style>
  </div>
);

// Wrapper components with Suspense
export const StepConfigPanel = (props) => (
  <Suspense fallback={<LoadingFallback componentName="workflow editor" />}>
    <LazyStepConfigPanel {...props} />
  </Suspense>
);

export const TaskForm = (props) => (
  <Suspense fallback={<LoadingFallback componentName="task form" />}>
    <LazyTaskForm {...props} />
  </Suspense>
);

export const FileManager = (props) => (
  <Suspense fallback={<LoadingFallback componentName="file manager" />}>
    <LazyFileManager {...props} />
  </Suspense>
);

export const SearchSuggestions = (props) => (
  <Suspense fallback={<LoadingFallback componentName="search suggestions" />}>
    <LazySearchSuggestions {...props} />
  </Suspense>
);

export default {
  StepConfigPanel,
  TaskForm,
  FileManager,
  SearchSuggestions
};