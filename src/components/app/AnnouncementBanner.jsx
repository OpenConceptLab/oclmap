import React from 'react';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import { MAPPER_ANNOUNCEMENT_URL } from '../../common/constants';

// Update announcement.* in the locale bundles (and bump ANNOUNCEMENT_ID) to
// re-show a new announcement to visitors who dismissed a previous one. Same
// pattern as the community site's and TBv3's AnnouncementBanner.
const ANNOUNCEMENT_ID = 'mapper-public-preview-2026-09';

const DISMISSED_KEY = 'announcementDismissed';

const isDismissed = () => {
  try {
    return localStorage.getItem(DISMISSED_KEY) === ANNOUNCEMENT_ID;
  } catch {
    return false;
  }
};

const rememberDismissal = () => {
  try {
    localStorage.setItem(DISMISSED_KEY, ANNOUNCEMENT_ID);
  } catch {
    // storage unavailable (private mode, blocked cookies); the banner simply reappears
  }
};

const AnnouncementBanner = () => {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(!isDismissed());

  const onClose = () => {
    rememberDismissal();
    setOpen(false);
  };

  if (!open)
    return null;

  return (
    <Alert
      severity='info'
      onClose={onClose}
      closeText={t('announcement.dismiss')}
      sx={{ margin: '8px 0', borderRadius: '8px' }}
    >
      <b>{t('announcement.title')}</b> {t('announcement.text')}{' '}
      <a className='link' href={MAPPER_ANNOUNCEMENT_URL} target='_blank' rel='noopener noreferrer'>{t('announcement.link_label')}</a>
    </Alert>
  );
};

export default AnnouncementBanner;
