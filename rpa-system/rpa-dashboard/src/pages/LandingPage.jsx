import React from 'react';

export default function LandingPage() {
  return (
    <div style={{ fontFamily: 'Inter, system-ui, -apple-system, Roboto, sans-serif' }}>
      <div style={{ position: 'relative' }}>
        <div style={{
          minHeight: '70vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }}>
          <div style={{ maxWidth: 980, textAlign: 'center' }}>
            <h1 style={{ fontSize: 46, margin: '0 0 12px' }}>🚀 EasyFlow</h1>
            <p style={{ fontSize: 18, margin: '0 0 24px', lineHeight: 1.5 }}>
              Transform your business with intelligent RPA automation. Streamline workflows, reduce manual tasks, and boost productivity with our powerful automation platform.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="/auth" style={{ background: 'rgba(255,255,255,0.12)', color: 'white', padding: '12px 20px', borderRadius: 8, textDecoration: 'none' }}>Get Started Today</a>
              <a href="/pricing" style={{ background: 'transparent', color: 'white', padding: '12px 20px', borderRadius: 8, textDecoration: 'underline' }}>Pricing</a>
            </div>
          </div>
        </div>
      </div>

      <section style={{ padding: 48, textAlign: 'center' }}>
        <h2 style={{ marginBottom: 20 }}>Why Choose EasyFlow?</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ padding: 18, borderRadius: 8, background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 28 }}>🤖</div>
            <h3>Intelligent Automation</h3>
            <p>Advanced RPA technology that learns and adapts to your business processes, making automation smarter and more efficient.</p>
          </div>
          <div style={{ padding: 18, borderRadius: 8, background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 28 }}>⚡</div>
            <h3>Lightning Fast</h3>
            <p>Execute complex tasks in seconds, not hours. Our optimized automation engine delivers results at incredible speed.</p>
          </div>
          <div style={{ padding: 18, borderRadius: 8, background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 28 }}>🔒</div>
            <h3>Enterprise Security</h3>
            <p>Bank-level security with encrypted data transmission, secure authentication, and compliance with industry standards.</p>
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <a href="/pricing" style={{ background: '#2563eb', color: 'white', padding: '12px 20px', borderRadius: 8, textDecoration: 'none' }}>Start Your Free Trial</a>
        </div>
      </section>

      <footer style={{ padding: 24, textAlign: 'center', color: '#666' }}>
        <p style={{ margin: 0 }}>&copy; 2025 EasyFlow. Intelligent RPA Automation Platform.</p>
        <div style={{ marginTop: 12 }}>
          <a href="tel:+12034494970" style={{ marginRight: 12, color: '#2563eb', textDecoration: 'none' }}>Call Support: +1 (203) 449-4970</a>
          <a href="mailto:kyjahntsmith@gmail.com" style={{ color: '#2563eb', textDecoration: 'none' }}>Email: kyjahntsmith@gmail.com</a>
        </div>
      </footer>
    </div>
  );
}
