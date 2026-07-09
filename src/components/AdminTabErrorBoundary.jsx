import React from 'react';

class AdminTabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Erro inesperado na aba.' };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: '' });
    }
  }

  componentDidCatch(error) {
    console.error('[ADMIN_TAB_ERROR]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 pb-32 text-center">
          <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-6 text-red-300 text-xs font-bold">
            Erro ao abrir esta aba. Troque de aba e tente novamente.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default AdminTabErrorBoundary;
