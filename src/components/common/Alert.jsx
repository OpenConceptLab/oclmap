import React from 'react';
import MuiAlert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';

const GenericAlert = React.forwardRef(function GenericAlert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

const Alert = ({message, duration, onClose, severity, action}) => {
  return (
    <Snackbar
      open={Boolean(message)}
      autoHideDuration={duration}
      onClose={onClose}
    >
      <GenericAlert onClose={onClose} severity={severity} action={action} sx={{ width: '100%' }}>
        {message}
      </GenericAlert>
    </Snackbar>
  )
}

export default Alert;
