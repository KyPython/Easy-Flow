import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import styles from './WorkflowTesting.module.css';
import { 
 FaPlay, 
 FaPlus, 
 FaTrash, 
 FaEdit,
 FaCheckCircle,
 FaTimesCircle,
 FaClock,
 FaChartLine,
 FaFlask,
 FaCog,
 FaExclamationTriangle
} from 'react-icons/fa';
import { useWorkflowTesting } from '../../hooks/useWorkflowTesting';
import LoadingSpinner from './LoadingSpinner';
import Modal from './Modal';
import ActionButton from './ActionButton';
import { useTheme } from '../../utils/ThemeContext';

const WorkflowTesting = ({ workflowId, workflowName }) => {
 const navigate = useNavigate();
 const { theme } = useTheme();
 const [showCreateModal, setShowCreateModal] = useState(false);
 const [selectedScenario, setSelectedScenario] = useState(null);
 const [showResultsModal, setShowResultsModal] = useState(false);
 
 const {
 testScenarios,
 loading,
 error,
 executing,
 loadTestScenarios,
 createTestScenario,
 executeTestScenario,
 runAllTests,
 deleteTestScenario
 } = useWorkflowTesting(workflowId);

 useEffect(() => {
 if (workflowId) {
 loadTestScenarios();
 }
 }, [workflowId, loadTestScenarios]);

 const handleCreateScenario = async (scenarioData) => {
 try {
 await createTestScenario(scenarioData);
 setShowCreateModal(false);
 } catch (err) {
 console.error('Failed to create test scenario:', err);
 alert('Failed to create test scenario: ' + err.message);
 }
 };

 const handleExecuteTest = async (scenarioId) => {
 try {
 const result = await executeTestScenario(scenarioId);
 console.log('Test executed:', result);
 } catch (err) {
 console.error('Failed to execute test:', err);
 alert('Failed to execute test: ' + err.message);
 }
 };

 const handleRunAllTests = async () => {
 try {
 const results = await runAllTests();
 console.log('All tests completed:', results);
 } catch (err) {
 console.error('Failed to run all tests:', err);
 alert('Failed to run all tests: ' + err.message);
 }
 };

 const handleDeleteScenario = async (scenarioId) => {
 if (!confirm('Are you sure you want to delete this test scenario?')) return;
 
 try {
 await deleteTestScenario(scenarioId);
 } catch (err) {
 console.error('Failed to delete test scenario:', err);
 alert('Failed to delete test scenario: ' + err.message);
 }
 };

 const getTestStats = () => {
 const total = testScenarios.length;
 const withResults = testScenarios.filter(s => s.workflow_test_results?.length > 0);
 const passed = withResults.filter(s => 
 s.workflow_test_results[0]?.status === 'passed'
 ).length;
 const failed = withResults.filter(s => 
 s.workflow_test_results[0]?.status === 'failed'
 ).length;

 return { total, passed, failed, coverage: total > 0 ? (withResults.length / total * 100) : 0 };
 };

 const stats = getTestStats();

 if (!workflowId) {
 return (
 <div className={styles.testingContainer}>
 <div className={styles.errorState}>
 <FaExclamationTriangle className={styles.errorIcon} />
 <h3>No Workflow Selected</h3>
 <p>Please select a workflow to access the testing framework</p>
 <ActionButton onClick={() => navigate('/app/workflows')}>
 Browse Workflows
 </ActionButton>
 </div>
 </div>
 );
 }

 if (loading) {
 return (
 <div className={styles.testingContainer}>
 <LoadingSpinner centered message="Loading test scenarios..." />
 </div>
 );
 }

 if (error) {
 return (
 <div className={styles.testingContainer}>
 <div className={styles.errorState}>
 <FaExclamationTriangle className={styles.errorIcon} />
 <h3>Testing Framework Error</h3>
 <p>{error}</p>
 <ActionButton onClick={() => window.location.reload()}>
 Retry
 </ActionButton>
 </div>
 </div>
 );
 }

 return (
 <div className={styles.testingContainer}>
 {/* Header */}
 <div className={styles.header}>
 <div className={styles.headerLeft}>
 <FaFlask className={styles.headerIcon} />
 <div>
 <h2>Workflow Testing</h2>
 <p>Test and validate your workflow behavior</p>
 </div>
 </div>
 <div className={styles.headerActions}>
 <ActionButton 
 variant="secondary" 
 onClick={() => setShowCreateModal(true)}
 >
 <FaPlus /> New Test
 </ActionButton>
 {testScenarios.length > 0 && (
 <ActionButton 
 variant="primary" 
 onClick={handleRunAllTests}
 disabled={executing}
 >
 <FaPlay /> Run All Tests
 </ActionButton>
 )}
 </div>
 </div>

 {/* Test Statistics */}
 <div className={styles.statsGrid}>
 <div className={styles.statCard}>
 <div className={styles.statIcon}>
 <FaFlask />
 </div>
 <div className={styles.statContent}>
 <div className={styles.statNumber}>{stats.total}</div>
 <div className={styles.statLabel}>Total Tests</div>
 </div>
 </div>
 <div className={styles.statCard}>
 <div className={styles.statIcon} style={{ color: 'var(--color-success-600)' }}>
 <FaCheckCircle />
 </div>
 <div className={styles.statContent}>
 <div className={styles.statNumber}>{stats.passed}</div>
 <div className={styles.statLabel}>Passed</div>
 </div>
 </div>
 <div className={styles.statCard}>
 <div className={styles.statIcon} style={{ color: 'var(--color-error-600)' }}>
 <FaTimesCircle />
 </div>
 <div className={styles.statContent}>
 <div className={styles.statNumber}>{stats.failed}</div>
 <div className={styles.statLabel}>Failed</div>
 </div>
 </div>
 <div className={styles.statCard}>
 <div className={styles.statIcon} style={{ color: 'var(--color-primary-600)' }}>
 <FaChartLine />
 </div>
 <div className={styles.statContent}>
 <div className={styles.statNumber}>{Math.round(stats.coverage)}%</div>
 <div className={styles.statLabel}>Coverage</div>
 </div>
 </div>
 </div>

 {/* Test Scenarios */}
 {testScenarios.length === 0 ? (
 <div className={styles.emptyState}>
 <FaFlask className={styles.emptyIcon} />
 <h3>No Test Scenarios</h3>
 <p>Create your first test scenario to start testing your workflow</p>
 <ActionButton 
 variant="primary" 
 onClick={() => setShowCreateModal(true)}
 >
 <FaPlus /> Create Test Scenario
 </ActionButton>
 </div>
 ) : (
 <div className={styles.scenariosList}>
 {testScenarios.map(scenario => (
 <TestScenarioCard
 key={scenario.id}
 scenario={scenario}
 onExecute={() => handleExecuteTest(scenario.id)}
 onDelete={() => handleDeleteScenario(scenario.id)}
 onViewResults={() => {
 setSelectedScenario(scenario);
 setShowResultsModal(true);
 }}
 executing={executing}
 />
 ))}
 </div>
 )}

 {/* Create Test Modal */}
 <Modal
 isOpen={showCreateModal}
 title="Create Test Scenario"
 onClose={() => setShowCreateModal(false)}
 >
 <CreateTestScenarioForm
 workflowId={workflowId}
 onSubmit={handleCreateScenario}
 onCancel={() => setShowCreateModal(false)}
 />
 </Modal>

 {/* Test Results Modal */}
 <Modal
 isOpen={showResultsModal && !!selectedScenario}
 title={`Test Results: ${selectedScenario ? selectedScenario.name : ''}`}
 onClose={() => setShowResultsModal(false)}
 size="large"
 >
 {selectedScenario && (
 <TestResultsView 
 scenario={selectedScenario}
 onClose={() => setShowResultsModal(false)}
 />
 )}
 </Modal>
 </div>
 );
};

const TestScenarioCard = ({ scenario, onExecute, onDelete, onViewResults, executing }) => {
 const latestResult = scenario.workflow_test_results?.[0];
 const hasResults = !!latestResult;
 
 const getStatusIcon = () => {
 if (!hasResults) return <FaClock className={styles.statusIcon} style={{ color: 'var(--text-muted)' }} />;
 if (latestResult.status === 'passed') return <FaCheckCircle className={styles.statusIcon} style={{ color: 'var(--color-success-600)' }} />;
 if (latestResult.status === 'failed') return <FaTimesCircle className={styles.statusIcon} style={{ color: 'var(--color-error-600)' }} />;
 return <FaClock className={styles.statusIcon} style={{ color: 'var(--color-warning-600)' }} />;
 };

 const getStatusText = () => {
 if (!hasResults) return 'Not run';
 return latestResult.status === 'passed' ? 'Passed' : 'Failed';
 };

 return (
 <div className={styles.scenarioCard}>
 <div className={styles.cardHeader}>
 <div className={styles.cardTitle}>
 <h4>{scenario.name}</h4>
 <div className={styles.statusBadge}>
 {getStatusIcon()}
 <span>{getStatusText()}</span>
 </div>
 </div>
 <div className={styles.cardActions}>
 <button
 className={styles.actionBtn}
 onClick={onExecute}
 disabled={executing}
 title="Run Test"
 >
 <FaPlay />
 </button>
 {hasResults && (
 <button
 className={styles.actionBtn}
 onClick={onViewResults}
 title="View Results"
 >
 <FaChartLine />
 </button>
 )}
 <button
 className={styles.actionBtn}
 onClick={onDelete}
 title="Delete Test"
 >
 <FaTrash />
 </button>
 </div>
 </div>
 
 <div className={styles.cardContent}>
 <p className={styles.description}>{scenario.description}</p>
 
 <div className={styles.cardMeta}>
 <span className={styles.metaItem}>
 <FaCog /> {scenario.test_steps?.length || 0} steps
 </span>
 {hasResults && (
 <span className={styles.metaItem}>
 <FaClock /> {latestResult.execution_time}ms
 </span>
 )}
 <span className={styles.metaItem}>
 Created {new Date(scenario.created_at).toLocaleDateString()}
 </span>
 </div>
 </div>
 </div>
 );
};

const CreateTestScenarioForm = ({ workflowId, onSubmit, onCancel }) => {
 const [formData, setFormData] = useState({
 name: '',
 description: '',
 inputData: '{}',
 expectedOutputs: '{}',
 testSteps: '[]',
 mockConfig: '{}'
 });

 const handleSubmit = (e) => {
 e.preventDefault();
 
 try {
 const scenarioData = {
 name: formData.name,
 description: formData.description,
 inputData: JSON.parse(formData.inputData),
 expectedOutputs: JSON.parse(formData.expectedOutputs),
 testSteps: JSON.parse(formData.testSteps),
 mockConfig: JSON.parse(formData.mockConfig)
 };
 
 onSubmit(scenarioData);
 } catch (err) {
 alert('Invalid JSON format: ' + err.message);
 }
 };

 return (
 <form onSubmit={handleSubmit} className={styles.createForm}>
 <div className={styles.formGroup}>
 <label>Test Name</label>
 <input
 type="text"
 value={formData.name}
 onChange={(e) => setFormData({ ...formData, name: e.target.value })}
 placeholder="e.g., Basic Email Flow Test"
 required
 title="Give your test a short, clear name. Example: 'Basic Email Flow Test'"
 />
 <div style={{ color: 'var(--text-muted, #888)', fontSize: '0.97em', margin: '2px 0 8px 2px' }}>
 <b>What is this?</b> Name your test so you can find it later. Example: <code>Basic Email Flow Test</code>
 </div>
 </div>
 <div className={styles.formGroup}>
 <label>Description</label>
 <textarea
 value={formData.description}
 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
 placeholder="Describe what this test validates..."
 rows={3}
 title="Describe what this test checks. Example: 'Checks if the email is sent when a user signs up.'"
 />
 <div style={{ color: 'var(--text-muted, #888)', fontSize: '0.97em', margin: '2px 0 8px 2px' }}>
 <b>What is this?</b> Write a short note about what this test does. Example: <code>Checks if the email is sent when a user signs up.</code>
 </div>
 </div>
 <div className={styles.formGroup}>
 <label>Input Data (JSON)</label>
 <textarea
 value={formData.inputData}
 onChange={(e) => setFormData({ ...formData, inputData: e.target.value })}
 placeholder='{"user_email": "test@example.com", "user_name": "Test User"}'
 rows={4}
 className={styles.codeInput}
 title={'Paste the input data for your workflow as JSON. Example: {"user_email": "test@example.com"}'}
 />
 <div style={{ color: 'var(--text-muted, #888)', fontSize: '0.97em', margin: '2px 0 8px 2px' }}>
 <b>What is this?</b> Enter the data your workflow will use. Example: <code>{'{"user_email": "test@example.com", "user_name": "Test User"}'}</code>
 </div>
 </div>
 <div className={styles.formGroup}>
 <label>Expected Outputs (JSON)</label>
 <textarea
 value={formData.expectedOutputs}
 onChange={(e) => setFormData({ ...formData, expectedOutputs: e.target.value })}
 placeholder='{"emails_sent": 2, "completion_status": "success"}'
 rows={4}
 className={styles.codeInput}
 title={'Paste the expected output as JSON. Example: {"emails_sent": 2, "completion_status": "success"}'}
 />
 <div style={{ color: 'var(--text-muted, #888)', fontSize: '0.97em', margin: '2px 0 8px 2px' }}>
 <b>What is this?</b> What should happen if the workflow works? Example: <code>{'{"emails_sent": 2, "completion_status": "success"}'}</code>
 </div>
 </div>
 <div className={styles.formActions}>
 <ActionButton type="button" variant="secondary" onClick={onCancel}>
 Cancel
 </ActionButton>
 <ActionButton type="submit" variant="primary">
 Create Test
 </ActionButton>
 </div>
 </form>
 );
};

const TestResultsView = ({ scenario, onClose }) => {
 const latestResult = scenario.workflow_test_results?.[0];
 
 if (!latestResult) {
 return (
 <div className={styles.noResults}>
 <p>No test results available. Run the test to see results.</p>
 </div>
 );
 }

 return (
 <div className={styles.resultsView}>
 <div className={styles.resultsSummary}>
 <div className={styles.summaryCard}>
 <div className={styles.summaryIcon}>
 {latestResult.status === 'passed' ? 
 <FaCheckCircle style={{ color: 'var(--color-success-600)' }} /> : 
 <FaTimesCircle style={{ color: 'var(--color-error-600)' }} />
 }
 </div>
 <div className={styles.summaryContent}>
 <h3>Test {latestResult.status === 'passed' ? 'Passed' : 'Failed'}</h3>
 <p>Executed in {latestResult.execution_time}ms</p>
 <p>Run on {new Date(latestResult.created_at).toLocaleString()}</p>
 </div>
 </div>
 </div>

 {latestResult.error_message && (
 <div className={styles.errorMessage}>
 <h4>Error Details</h4>
 <pre>{latestResult.error_message}</pre>
 </div>
 )}

 <div className={styles.stepResults}>
 <h4>Step Results</h4>
 {latestResult.step_results?.map((stepResult, index) => (
 <div key={index} className={styles.stepResult}>
 <div className={styles.stepHeader}>
 <span className={styles.stepName}>{stepResult.stepType}</span>
 <span className={`${styles.stepStatus} ${styles[stepResult.status]}`}>
 {stepResult.status}
 </span>
 </div>
 <div className={styles.stepDetails}>
 <p><strong>Execution Time:</strong> {stepResult.executionTime}ms</p>
 {stepResult.error && (
 <p className={styles.stepError}><strong>Error:</strong> {stepResult.error}</p>
 )}
 </div>
 </div>
 ))}
 </div>
 </div>
 );
};

WorkflowTesting.propTypes = {
 workflowId: PropTypes.string,
 workflowName: PropTypes.string
};

TestScenarioCard.propTypes = {
 scenario: PropTypes.object.isRequired,
 onExecute: PropTypes.func.isRequired,
 onDelete: PropTypes.func.isRequired,
 onViewResults: PropTypes.func.isRequired,
 executing: PropTypes.bool.isRequired
};

CreateTestScenarioForm.propTypes = {
 workflowId: PropTypes.string.isRequired,
 onSubmit: PropTypes.func.isRequired,
 onCancel: PropTypes.func.isRequired
};

TestResultsView.propTypes = {
 scenario: PropTypes.object.isRequired,
 onClose: PropTypes.func.isRequired
};

export default WorkflowTesting;