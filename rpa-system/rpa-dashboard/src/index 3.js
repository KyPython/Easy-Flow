import React from 'react';
import ReactDOM from 'react-dom/client';

const root = ReactDOM.createRoot(document.getElementById('root'));

// ABSOLUTE MINIMUM - just render text
root.render(
 <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
 <h1>✅ React is working!</h1>
 <p>If you can see this, React rendered successfully.</p>
 <p>The problem was with other imports/components.</p>
 </div>
);