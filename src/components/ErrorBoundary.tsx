import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public props: Props;
  public state: State;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center p-6 font-serif">
          <div className="max-w-md w-full bg-white rounded-[32px] p-10 shadow-xl text-center border border-[#5A5A40]/10">
            <div className="h-16 w-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-[#5A5A40] mb-4">Something went wrong</h2>
            <p className="text-[#5A5A40]/60 italic mb-8">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-[#5A5A40] text-white py-4 rounded-full flex items-center justify-center gap-3 font-medium hover:bg-[#5A5A40]/90 transition-colors"
            >
              <RefreshCcw size={20} />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
