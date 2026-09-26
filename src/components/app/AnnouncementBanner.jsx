import React from 'react';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import { MAPPER_ANNOUNCEMENT_URL } from '../../common/constants';

// Update announcement.* in the locale bundles (and bump ANNOUNCEMENT_ID) to
// re-show a new announcement to visitors who dismissed a previous one. Same
// pattern as the community site's and TBv3's AnnouncementBanner.
const ANNOUNCEMENT_ID = 'mapper-public-preview-2026-09';

const DISMISSED_KEY = 'announcementDismissed';

// Read by --app-height in index.scss, which page heights subtract from 100vh.
const HEIGHT_VAR = '--announcement-height';

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
  const ref = React.useRef(null);

  // Publish the banner's height (it wraps on narrow screens and in longer
  // translations) and clear it once dismissed.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el)
      return;
    const root = document.documentElement.style;
    const update = () => root.setProperty(HEIGHT_VAR, `${el.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.removeProperty(HEIGHT_VAR);
    };
  }, [open]);

  const onClose = () => {
    rememberDismissal();
    setOpen(false);
  };

  if (!open)
    return null;

  // Padding rather than the Alert's margin, so offsetHeight includes the gap.
  return (
    <div ref={ref} style={{ padding: '8px 0' }}>
      <Alert
        severity='info'
        onClose={onClose}
        closeText={t('announcement.dismiss')}
        sx={{ borderRadius: '8px' }}
      >
        <b>{t('announcement.title')}</b> {t('announcement.text')}{' '}
        <a className='link' href={MAPPER_ANNOUNCEMENT_URL} target='_blank' rel='noopener noreferrer'>{t('announcement.link_label')}</a>
      </Alert>
    </div>
  );
};

export default AnnouncementBanner;
