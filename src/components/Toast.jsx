import React from 'react';

const Toast = ({ message, type = 'success', onClose }) => {
  if (!message) return null;
  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded shadow-lg text-white ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}
         onClick={onClose}>
      {message}
    </div>
  );
};

export default Toast;
