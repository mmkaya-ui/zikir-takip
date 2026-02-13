'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6 text-center bg-black text-white">
                    <h2 className="text-2xl font-bold text-red-500 mb-4">Bir şeyler ters gitti.</h2>
                    <p className="text-gray-400 mb-6 text-sm">
                        Uygulama beklenmedik bir hatayla karşılaştı. Lütfen sayfayı yenileyin.
                    </p>
                    <div className="p-4 bg-gray-900 rounded-lg text-xs font-mono text-left w-full overflow-auto max-h-40 border border-gray-800 mb-6">
                        {this.state.error?.toString()}
                    </div>
                    <button
                        className="px-6 py-3 bg-blue-600 rounded-full font-bold active:scale-95 transition-transform"
                        onClick={() => window.location.reload()}
                    >
                        Sayfayı Yenile
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
