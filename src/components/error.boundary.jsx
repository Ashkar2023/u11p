import { Component } from "react";

export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error("Uncaught error:", error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            const { error } = this.state;
            return (
                <div style={{ padding: "1rem", fontFamily: "monospace", fontSize: "14px" }}>
                    <h2 style={{ color: "red" }}>Error</h2>
                    <p><strong>Message:</strong> {error?.message}</p>
                    <p><strong>Name:</strong> {error?.name}</p>
                    <pre style={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        background: "#f5f5f5",
                        padding: "1rem",
                        fontSize: "12px"
                    }}>
                        {error?.stack}
                    </pre>
                    <button onClick={() => this.setState({ hasError: false, error: null })}>
                        Try again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}