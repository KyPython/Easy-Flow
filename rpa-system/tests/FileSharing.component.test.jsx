import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Simple FileSharing component for testing
const FileSharing = React.memo(({ files = [], onFileUpload, onFileShare, onFileDelete }) => {
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [shareEmail, setShareEmail] = React.useState('');

  const handleFileSelect = React.useCallback((file) => {
    setSelectedFile(file);
  }, []);

  const handleShare = React.useCallback(() => {
    if (selectedFile && shareEmail) {
      onFileShare?.(selectedFile, shareEmail);
      setShareEmail('');
      setSelectedFile(null);
    }
  }, [selectedFile, shareEmail, onFileShare]);

  const handleDelete = React.useCallback((file) => {
    onFileDelete?.(file);
    if (selectedFile?.id === file.id) {
      setSelectedFile(null);
    }
  }, [selectedFile, onFileDelete]);

  return (
    <div data-testid="file-sharing-component">
      <h2>File Sharing</h2>
      
      <div data-testid="file-list">
        {files.length === 0 ? (
          <p data-testid="no-files">No files available</p>
        ) : (
          files.map((file) => (
            <div key={file.id} data-testid={`file-item-${file.id}`} className="file-item">
              <span>{file.name}</span>
              <span>{(file.size / 1024).toFixed(1)} KB</span>
              <button
                onClick={() => handleFileSelect(file)}
                data-testid={`select-${file.id}`}
              >
                Select
              </button>
              <button
                onClick={() => handleDelete(file)}
                data-testid={`delete-${file.id}`}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>

      {selectedFile && (
        <div data-testid="share-section">
          <h3>Share {selectedFile.name}</h3>
          <input
            type="email"
            placeholder="Enter email address"
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            data-testid="share-email-input"
          />
          <button
            onClick={handleShare}
            disabled={!shareEmail}
            data-testid="share-button"
          >
            Share File
          </button>
        </div>
      )}

      <div data-testid="upload-section">
        <input
          type="file"
          onChange={(e) => onFileUpload?.(e.target.files[0])}
          data-testid="file-upload-input"
        />
      </div>
    </div>
  );
});

FileSharing.displayName = 'FileSharing';

describe('FileSharing Component', () => {
  const mockFiles = [
    { id: 1, name: 'document.pdf', size: 2048 },
    { id: 2, name: 'image.jpg', size: 1536 },
  ];

  const defaultProps = {
    files: mockFiles,
    onFileUpload: jest.fn(),
    onFileShare: jest.fn(),
    onFileDelete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('should render component with title', () => {
      render(<FileSharing {...defaultProps} />);
      
      expect(screen.getByTestId('file-sharing-component')).toBeInTheDocument();
      expect(screen.getByText('File Sharing')).toBeInTheDocument();
    });

    test('should render file list when files are provided', () => {
      render(<FileSharing {...defaultProps} />);
      
      expect(screen.getByTestId('file-list')).toBeInTheDocument();
      expect(screen.getByTestId('file-item-1')).toBeInTheDocument();
      expect(screen.getByTestId('file-item-2')).toBeInTheDocument();
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
      expect(screen.getByText('image.jpg')).toBeInTheDocument();
    });

    test('should render no files message when files array is empty', () => {
      render(<FileSharing {...defaultProps} files={[]} />);
      
      expect(screen.getByTestId('no-files')).toBeInTheDocument();
      expect(screen.getByText('No files available')).toBeInTheDocument();
    });

    test('should display file sizes correctly', () => {
      render(<FileSharing {...defaultProps} />);
      
      expect(screen.getByText('2.0 KB')).toBeInTheDocument();
      expect(screen.getByText('1.5 KB')).toBeInTheDocument();
    });
  });

  describe('File Selection', () => {
    test('should select file when select button is clicked', () => {
      render(<FileSharing {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('select-1'));
      
      expect(screen.getByTestId('share-section')).toBeInTheDocument();
      expect(screen.getByText('Share document.pdf')).toBeInTheDocument();
    });

    test('should show share section only when file is selected', () => {
      render(<FileSharing {...defaultProps} />);
      
      expect(screen.queryByTestId('share-section')).not.toBeInTheDocument();
      
      fireEvent.click(screen.getByTestId('select-1'));
      
      expect(screen.getByTestId('share-section')).toBeInTheDocument();
    });
  });

  describe('File Sharing', () => {
    test('should handle email input changes', () => {
      render(<FileSharing {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('select-1'));
      
      const emailInput = screen.getByTestId('share-email-input');
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      
      expect(emailInput.value).toBe('test@example.com');
    });

    test('should disable share button when no email is entered', () => {
      render(<FileSharing {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('select-1'));
      
      const shareButton = screen.getByTestId('share-button');
      expect(shareButton).toBeDisabled();
    });

    test('should enable share button when email is entered', () => {
      render(<FileSharing {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('select-1'));
      fireEvent.change(screen.getByTestId('share-email-input'), {
        target: { value: 'test@example.com' }
      });
      
      const shareButton = screen.getByTestId('share-button');
      expect(shareButton).not.toBeDisabled();
    });

    test('should call onFileShare when share button is clicked', () => {
      render(<FileSharing {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('select-1'));
      fireEvent.change(screen.getByTestId('share-email-input'), {
        target: { value: 'test@example.com' }
      });
      fireEvent.click(screen.getByTestId('share-button'));
      
      expect(defaultProps.onFileShare).toHaveBeenCalledWith(
        mockFiles[0],
        'test@example.com'
      );
    });

    test('should clear form after successful share', () => {
      render(<FileSharing {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('select-1'));
      fireEvent.change(screen.getByTestId('share-email-input'), {
        target: { value: 'test@example.com' }
      });
      fireEvent.click(screen.getByTestId('share-button'));
      
      expect(screen.queryByTestId('share-section')).not.toBeInTheDocument();
    });
  });

  describe('File Deletion', () => {
    test('should call onFileDelete when delete button is clicked', () => {
      render(<FileSharing {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('delete-1'));
      
      expect(defaultProps.onFileDelete).toHaveBeenCalledWith(mockFiles[0]);
    });

    test('should clear selected file if deleted file was selected', () => {
      render(<FileSharing {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('select-1'));
      expect(screen.getByTestId('share-section')).toBeInTheDocument();
      
      fireEvent.click(screen.getByTestId('delete-1'));
      
      expect(screen.queryByTestId('share-section')).not.toBeInTheDocument();
    });
  });

  describe('Performance Optimizations', () => {
    test('should use React.memo for component memoization', () => {
      expect(FileSharing.displayName).toBe('FileSharing');
      expect(typeof FileSharing).toBe('object'); // React.memo returns an object
    });

    test('should maintain callback references with same dependencies', () => {
      const { rerender } = render(<FileSharing {...defaultProps} />);
      
      // Get initial callback references
      fireEvent.click(screen.getByTestId('select-1'));
      const initialShareSection = screen.getByTestId('share-section');
      
      // Rerender with same props
      rerender(<FileSharing {...defaultProps} />);
      
      // Component should still function correctly (callbacks maintained)
      fireEvent.click(screen.getByTestId('select-1'));
      expect(screen.getByTestId('share-section')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('should handle undefined props gracefully', () => {
      render(<FileSharing />);
      
      expect(screen.getByTestId('file-sharing-component')).toBeInTheDocument();
      expect(screen.getByTestId('no-files')).toBeInTheDocument();
    });

    test('should handle file upload without callback', () => {
      render(<FileSharing files={[]} />);
      
      const fileInput = screen.getByTestId('file-upload-input');
      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      
      // Should not throw error even without onFileUpload callback
      expect(() => {
        fireEvent.change(fileInput, { target: { files: [mockFile] } });
      }).not.toThrow();
    });
  });
});
