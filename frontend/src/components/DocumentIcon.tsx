import React from 'react'

interface DocumentIconProps {
  hasNotes: boolean
  className?: string
}

const DocumentIcon: React.FC<DocumentIconProps> = ({ hasNotes, className = "w-5 h-5" }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Document outline with black stroke */}
      <path 
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" 
        fill="white"
        stroke="black"
      />
      <polyline 
        points="14,2 14,8 20,8" 
        fill="white"
        stroke="black"
      />
      
      {/* Lines inside document - only show if hasNotes */}
      {hasNotes && (
        <>
          <line x1="8" y1="12" x2="16" y2="12" stroke="black" />
          <line x1="8" y1="16" x2="16" y2="16" stroke="black" />
          <line x1="8" y1="20" x2="12" y2="20" stroke="black" />
        </>
      )}
    </svg>
  )
}

export default DocumentIcon
