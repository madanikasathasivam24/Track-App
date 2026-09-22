import React from 'react';

interface TimeSpinnerProps {
  value: Date;
  onChange: (date: Date) => void;
}

// @react-native-community/datetimepicker has no web implementation at all —
// its own generic fallback just renders null with a console warning (see
// node_modules/@react-native-community/datetimepicker/src/datetimepicker.js).
// This is the browser's built-in equivalent instead.
export function TimeSpinner({ value, onChange }: TimeSpinnerProps) {
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');

  return (
    <input
      type="time"
      value={`${hours}:${minutes}`}
      onChange={(e) => {
        const [h, m] = e.target.value.split(':').map(Number);
        if (Number.isFinite(h) && Number.isFinite(m)) {
          const next = new Date(value);
          next.setHours(h, m, 0, 0);
          onChange(next);
        }
      }}
      style={{
        fontSize: 20,
        padding: 12,
        margin: 16,
        borderRadius: 8,
        border: '1px solid #E1E8E8',
      }}
    />
  );
}
