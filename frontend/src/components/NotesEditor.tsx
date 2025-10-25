import React, { useState, useEffect } from 'react'
import { X, Save, FileText } from 'lucide-react'

interface NotesEditorProps {
  bookingId: string
  initialNotes: string
  isOpen: boolean
  onClose: () => void
  onSave: (bookingId: string, notes: string) => Promise<void>
}

const NotesEditor: React.FC<NotesEditorProps> = ({
  bookingId,
  initialNotes,
  isOpen,
  onClose,
  onSave
}) => {
  const [notes, setNotes] = useState(initialNotes)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setNotes(initialNotes)
  }, [initialNotes, isOpen])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(bookingId, notes)
      onClose()
    } catch (error) {
      console.error('Error saving notes:', error)
      // You could add a toast notification here
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSave()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center">
            <FileText className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Booking Notes</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add notes about this booking..."
            className="w-full h-64 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-feline-500 focus:border-feline-500 resize-none"
            autoFocus
          />
          <div className="mt-2 text-xs text-gray-500">
            Press Ctrl+S (or Cmd+S) to save, or Escape to cancel
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-feline-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-feline-600 border border-transparent rounded-md hover:bg-feline-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-feline-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Notes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default NotesEditor
