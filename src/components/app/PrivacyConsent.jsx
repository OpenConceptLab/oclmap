import React from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import Dialog from '../common/Dialog';
import DialogTitle from '../common/DialogTitle';
import { PRIVACY_POLICY_URL } from '../../common/constants';
import { acceptAll, hasDecided, isGranted, onConsentChange, rejectAll, saveConsent } from '../../services/consent';
import HotjarService from '../../services/HotjarService';

// Consent for optional tracking (OpenConceptLab/ocl_online#533): a banner until
// the person decides, with one Accept for everything plus Reject and Choose, and
// a preferences dialog, also opened from the footer, to change the choice by
// category at any time. Refusing takes no more effort than accepting.
// Requirements: docs/ocl_online-533-hotjar-heatmaps-plan.md (R1, R2).

// Hotjar cannot be stopped once its script runs, so turning heatmaps off while it
// runs reloads the page (projects autosave).
const decide = save => {
  const wasRunning = HotjarService.isRunning();
  const consent = save();
  if(wasRunning && !consent.heatmaps)
    window.location.reload();
};

const LINK_SX = { fontWeight: 600, whiteSpace: 'nowrap', '&:hover, &:focus': { color: 'primary.main' } };

const Category = ({ title, text, control }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, py: 1.5 }}>
    <Box>
      <Typography sx={{ fontWeight: 600, color: 'surface.dark' }}>{title}</Typography>
      <Typography variant='body2' sx={{ color: 'surface.contrastText' }}>{text}</Typography>
    </Box>
    {control}
  </Box>
);

const PrivacyConsent = ({ preferencesOpen, onPreferencesChange }) => {
  const { t } = useTranslation();
  const [decided, setDecided] = React.useState(() => hasDecided());
  const [heatmaps, setHeatmaps] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = onConsentChange(() => setDecided(true));
    return () => { unsubscribe(); };
  }, []);

  // The dialog starts from what is saved, each time it opens
  React.useEffect(() => {
    if(preferencesOpen)
      setHeatmaps(isGranted('heatmaps'));
  }, [preferencesOpen]);

  if(!HotjarService.isConfigured())
    return null;

  const closePreferences = () => onPreferencesChange(false);
  const onSave = () => {
    decide(() => saveConsent({ heatmaps }));
    closePreferences();
  };
  const reloads = HotjarService.isRunning() && !heatmaps;

  return (
    <React.Fragment>
      {
        !decided &&
          <Box
            role='region'
            aria-label={t('privacy_consent.preferences')}
            className='mui-fixed'
            sx={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: theme => theme.zIndex.drawer + 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1.5,
              backgroundColor: 'primary.95',
              py: 1.5,
              px: { xs: 2, sm: 3 },
            }}
          >
            <Typography variant='body2' sx={{ color: 'surface.contrastText', flex: '1 1 400px' }}>
              {t('privacy_consent.banner_text')}{' '}
              <Link href={PRIVACY_POLICY_URL} target='_blank' rel='noopener noreferrer' sx={LINK_SX}>
                {t('common.privacy_policy')}
              </Link>
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant='contained' sx={{ textTransform: 'none' }} onClick={() => decide(acceptAll)}>{t('privacy_consent.accept')}</Button>
              <Button variant='contained' sx={{ textTransform: 'none' }} onClick={() => decide(rejectAll)}>{t('privacy_consent.reject')}</Button>
              <Button variant='text' sx={{ textTransform: 'none' }} onClick={() => onPreferencesChange(true)}>{t('privacy_consent.choose')}</Button>
            </Box>
          </Box>
      }
      <Dialog open={Boolean(preferencesOpen)} onClose={closePreferences} maxWidth='sm' fullWidth>
        <DialogTitle>{t('privacy_consent.preferences')}</DialogTitle>
        <DialogContent sx={{ padding: 0, paddingTop: '12px !important' }}>
          <Category
            title={t('privacy_consent.essential_title')}
            text={t('privacy_consent.essential_text')}
            control={<Typography variant='body2' sx={{ whiteSpace: 'nowrap', pt: 0.5 }}>{t('privacy_consent.always_on')}</Typography>}
          />
          <Category
            title={t('privacy_consent.heatmaps_title')}
            text={t('privacy_consent.heatmaps_text')}
            control={
              <FormControlLabel
                sx={{ m: 0 }}
                label=''
                aria-label={t('privacy_consent.heatmaps_title')}
                control={<Switch checked={heatmaps} onChange={event => setHeatmaps(event.target.checked)} />}
              />
            }
          />
          {
            reloads &&
              <Typography variant='body2' sx={{ color: 'surface.contrastText', pt: 1 }}>{t('privacy_consent.reload_notice')}</Typography>
          }
          <Typography variant='body2' sx={{ pt: 1 }}>
            <Link href={PRIVACY_POLICY_URL} target='_blank' rel='noopener noreferrer' sx={LINK_SX}>{t('common.privacy_policy')}</Link>
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 0, pb: 0 }}>
          <Button sx={{ textTransform: 'none' }} onClick={closePreferences}>{t('common.cancel')}</Button>
          <Button variant='contained' sx={{ textTransform: 'none' }} onClick={onSave}>{t('privacy_consent.save')}</Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
};

export default PrivacyConsent;
