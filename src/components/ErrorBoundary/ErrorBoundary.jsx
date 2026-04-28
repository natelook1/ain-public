import React from 'react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback ?? (
                <div style={{ padding: '2rem', color: 'var(--text-muted, #888)', textAlign: 'center' }}>
                    Something went wrong. <button onClick={() => this.setState({ hasError: false, error: null })}>Retry</button>
                </div>
            );
        }
        return this.props.children;
    }
}
