import React from 'react';
import PropTypes from 'prop-types';

export default function LogsTable({ logs }) {
  return (
    <table border="1" cellPadding="10" cellSpacing="0" width="100%">
      <thead>
        <tr>
          <th>ID</th>
          <th>Task</th>
          <th>URL</th>
          <th>Username</th>
          <th>Result</th>
          <th>Created At</th>
        </tr>
      </thead>
      <tbody>
        {logs.map(log => (
          <tr key={log.id}>
            <td>{log.id}</td>
            <td>{log.task}</td>
            <td><a href={log.url} target="_blank" rel="noreferrer">{log.url}</a></td>
            <td>{log.username}</td>
            <td>{log.result?.message || '-'}</td>
            <td>{new Date(log.created_at).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

LogsTable.propTypes = {
  logs: PropTypes.arrayOf(PropTypes.object).isRequired,
};
