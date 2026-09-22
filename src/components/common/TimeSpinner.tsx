import React from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';

interface TimeSpinnerProps {
  value: Date;
  onChange: (date: Date) => void;
}

export function TimeSpinner({ value, onChange }: TimeSpinnerProps) {
  return (
    <DateTimePicker
      value={value}
      mode="time"
      display="spinner"
      onChange={(_event, date) => {
        if (date) onChange(date);
      }}
    />
  );
}
