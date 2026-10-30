import React from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { getAnnouncement, isDismissed, msUntilExpiry, rememberDismissal } from '../../common/announcement';

// This deployment's announcement, from its ANNOUNCEMENT setting (README,
// "Announcement banner"), fixed above the app bar. Same component in TBv3
// and TBv2. Unset, malformed or past its until, nothing shows. Text and
// labels show as plain text. A dismissal lasts until the setting's id changes.

// The banner's height while it shows. Header moves the app bar and the content
// down by it, and --app-height in index.scss subtracts it from 100vh.
const HEIGHT_VAR = '--announcement-height';

const AnnouncementBanner = () => {
  const { t, i18n } = useTranslation();
  const [now, setNow] = React.useState(Date.now);
  const announcement = getAnnouncement(window.ANNOUNCEMENT, i18n.language, now);
  const [dismissed, setDismissed] = React.useState(() => Boolean(announcement) && isDismissed(announcement.id));
  const open = Boolean(announcement) && !dismissed;
  const ref = React.useRef(null);

  // Check again when until arrives, so the banner hides on a page left open.
  const delay = open ? msUntilExpiry(announcement, now) : null;
  React.useEffect(() => {
    if (delay === null)
      return;
    const timer = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [delay, now]);

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
    rememberDismissal(announcement.id);
    setDismissed(true);
  };

  if (!open)
    return null;

  // Gutters match the app bar's Toolbar, so the icon lines up with the logo and
  // the close button with the header controls. mui-fixed lets MUI's scroll lock
  // pad it like the app bar when a modal opens.
  return (
    <Box
      ref={ref}
      className='mui-fixed'
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: theme => theme.zIndex.drawer + 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'primary.95',
        py: 1,
        pl: { xs: 2, sm: 3 },
        pr: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <CampaignOutlinedIcon color='primary' fontSize='small' />
        <Typography variant='body2' sx={{ fontWeight: 600, color: 'surface.dark' }}>
          {announcement.text}
        </Typography>
        {
          announcement.links.length > 0 &&
            <Typography variant='body2' sx={{ color: 'surface.contrastText' }}>
              {announcement.links.map(({ label, url }, i) => (
                <React.Fragment key={i}>
                  {i ? ' · ' : ''}
                  <Link href={url} target='_blank' rel='noopener noreferrer' sx={{ fontWeight: 600, whiteSpace: 'nowrap', '&:hover, &:focus': { color: 'primary.main' } }}>
                    {label}
                  </Link>
                </React.Fragment>
              ))}
            </Typography>
        }
      </Box>
      <IconButton size='small' aria-label={t('common.close')} onClick={onClose}>
        <CloseIcon fontSize='small' />
      </IconButton>
    </Box>
  );
};

export default AnnouncementBanner;
