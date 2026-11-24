import React from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined'
import CloseIcon from '@mui/icons-material/Close'
import CorporateFareIcon from '@mui/icons-material/CorporateFare'
import DoNotDisturbOnOutlinedIcon from '@mui/icons-material/DoNotDisturbOnOutlined'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined'
import EventRepeatIcon from '@mui/icons-material/EventRepeat'
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined'
import HelpOutlineIcon from '@mui/icons-material/HelpOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'

import GAService from '../../services/GAService'
import Dialog from './Dialog'
import DialogTitle from './DialogTitle'
import CloseIconButton from './CloseIconButton'
import { getLimitSubject } from './limitAction'
import { getNoticeIcon, getNoticeTone, orderActions } from './limitNotice.js'

// The one slot for a limit notice (OpenConceptLab/ocl_online#702): a dialog, a
// strip or an inline notice, as in TBv3. It takes a notice from
// normalizeNotice and renders each field it has, in the colour its tone names.
// Without a notice it shows the API's `detail` and nothing else.
//
// Not yet in the OCL design system (it has no strip or inline alert besides the
// announcement banner): built from its foundations, the 28px dialog, pill
// buttons and LinearProgress.

const TONES = {
  info: {main: 'primary.main', bg: 'primary.95', border: 'primary.80', track: 'primary.90'},
  warning: {main: 'warning.main', bg: '#fff4e5', border: '#f6c28b', track: '#fde3c8'},
  error: {main: 'error.main', bg: 'error.95', border: '#f2b8b5', track: '#ffdad6'},
}
const toneOf = tone => TONES[tone] || TONES.info

const ICONS = {lock: LockOutlinedIcon, info: InfoOutlinedIcon, warning: WarningAmberIcon, error: ErrorOutlineIcon}
const NoticeIcon = ({notice, ...rest}) => {
  const Icon = ICONS[getNoticeIcon(notice)] || InfoOutlinedIcon
  return <Icon {...rest} />
}

const Bar = ({meter, tone, height = 8, sx}) => {
  if(typeof meter?.fraction !== 'number')
    return null
  const colours = toneOf(meter.tone || tone)
  return (
    <LinearProgress
      variant='determinate'
      value={meter.fraction * 100}
      aria-label={meter.label}
      sx={{height, borderRadius: height / 2, backgroundColor: colours.track, '& .MuiLinearProgress-bar': {backgroundColor: colours.main, borderRadius: height / 2}, ...sx}}
    />
  )
}

const BUTTON_VARIANTS = {primary: 'contained', secondary: 'outlined', text: 'text'}

// Every link opens in a new tab, so the project stays as it is; the way out
// says so.
const ActionButton = ({action, size, onClick}) => {
  const variant = BUTTON_VARIANTS[action.kind]
  const contained = variant === 'contained'
  return (
    <Button
      href={action.url}
      target='_blank'
      rel='noopener noreferrer'
      variant={variant}
      size={size}
      onClick={() => onClick?.(action)}
      endIcon={contained ? <OpenInNewIcon /> : undefined}
      sx={{
        textTransform: 'none',
        borderRadius: '100px',
        flexShrink: 0,
        ...(variant === 'outlined' ? {backgroundColor: 'rgba(255,255,255,.6)'} : {}),
        '&, &:hover, &:focus, &:active': {color: contained ? 'primary.contrastText' : 'primary.main', textDecoration: 'none'},
        '&:focus:not(:focus-visible)': {outline: 'none'},
      }}
    >
      {action.label}
    </Button>
  )
}

const HelpLink = ({help, sx}) => (
  <Link href={help.url} target='_blank' rel='noopener noreferrer' underline='hover' sx={{display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: '13.5px', fontWeight: 500, '&:hover, &:focus': {color: 'primary.main'}, ...sx}}>
    <HelpOutlineIcon sx={{fontSize: '17px'}} />
    {help.label}
  </Link>
)

const Scope = ({notice, sx}) => {
  if(!notice.scope)
    return null
  const Icon = notice.scope_type === 'organization' ? CorporateFareIcon : PersonOutlineIcon
  return (
    <Box sx={{display: 'flex', alignItems: 'center', gap: 0.75, fontSize: '13px', color: 'secondary.main', ...sx}}>
      <Icon sx={{fontSize: '17px'}} />
      <span>{notice.scope}</span>
    </Box>
  )
}

const Reset = ({notice}) => notice.reset ? (
  <Box sx={{display: 'flex', alignItems: 'flex-start', gap: 0.75, fontSize: '13px', color: 'surface.contrastText'}}>
    <EventRepeatIcon sx={{fontSize: '17px', color: 'secondary.main', mt: '1px'}} />
    <span>{notice.reset}</span>
  </Box>
) : null

const Meter = ({notice, labelSize}) => notice.meter ? (
  <Box sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
    {
      notice.meter.label &&
        <Typography component='div' sx={{fontSize: labelSize, fontWeight: 500, color: 'surface.dark', fontVariantNumeric: 'tabular-nums'}}>
          {notice.meter.label}
        </Typography>
    }
    <Bar meter={notice.meter} tone={getNoticeTone(notice)} />
  </Box>
) : null

// Restricted, still works and who manages the plan, each with its icon.
const Rows = ({notice, labelled}) => {
  const { t } = useTranslation()
  const colours = toneOf(getNoticeTone(notice))
  const rows = [
    notice.restricted && {key: 'restricted', Icon: notice.kind === 'read_only' ? LockOutlinedIcon : DoNotDisturbOnOutlinedIcon, colour: colours.main, label: t('limit_notice.restricted'), text: notice.restricted},
    notice.still_works && {key: 'still_works', Icon: CheckCircleOutlineIcon, colour: '#2e7d32', label: t('limit_notice.still_works'), text: notice.still_works},
    notice.managed_by && {key: 'managed_by', Icon: GroupOutlinedIcon, colour: 'secondary.main', text: notice.managed_by},
  ].filter(Boolean)
  return rows.map(({key, Icon, colour, label, text}) => (
    <Box key={key} sx={{display: 'flex', gap: 1.25, alignItems: 'flex-start'}}>
      <Icon sx={{fontSize: '20px', mt: '1px', color: colour}} />
      <div>
        {labelled && label && <Typography component='span' sx={{display: 'block', fontSize: '12px', fontWeight: 700, color: 'secondary.main', mb: '1px'}}>{label}</Typography>}
        {text}
      </div>
    </Box>
  ))
}

// Records the notice once it shows, and each action followed, as the limit
// dialogs do (useLimitAction).
const useNoticeEvents = (open, errorCode, capability) => {
  const subject = getLimitSubject(errorCode, capability)
  React.useEffect(() => {
    if(open)
      GAService.recordActionEvent('Limit', 'limit_hit', errorCode, subject)
  }, [open, errorCode, capability])
  return action => GAService.recordActionEvent('Limit', 'limit_action_click', errorCode, {...subject, action_kind: action.kind})
}

const NoticeDialog = ({open, onClose, notice, errorCode, capability}) => {
  const { t } = useTranslation()
  const onActionClick = useNoticeEvents(open, errorCode, capability)
  const actions = orderActions(notice.actions, 'dialog')
  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle sx={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5}}>
        {notice.title}
        <CloseIconButton onClick={onClose} aria-label={t('common.close')} sx={{mt: -0.5, mr: -1, ml: 'auto'}} />
      </DialogTitle>
      <DialogContent sx={{px: 0, pb: 0}}>
        <Scope notice={notice} sx={{mt: 1}} />
        {
          (notice.meter || notice.reset) &&
            <Box sx={{mt: 2, backgroundColor: 'white', borderRadius: '16px', px: 2, py: 1.75, display: 'flex', flexDirection: 'column', gap: 1}}>
              <Meter notice={notice} labelSize='15px' />
              <Reset notice={notice} />
            </Box>
        }
        <Box sx={{mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5, fontSize: '14.5px', lineHeight: 1.5, color: 'surface.contrastText'}}>
          <Rows notice={notice} labelled />
        </Box>
      </DialogContent>
      <DialogActions disableSpacing sx={{p: 0, pt: 3, gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end', flexDirection: {xs: 'column-reverse', sm: 'row'}, alignItems: {xs: 'stretch', sm: 'center'}}}>
        {notice.help && <HelpLink help={notice.help} sx={{mr: {sm: 'auto'}, alignSelf: {xs: 'center', sm: 'auto'}, mt: {xs: 1, sm: 0}}} />}
        {
          actions.length ?
            actions.map((action, i) => <ActionButton key={i} action={action} onClick={onActionClick} />) :
            <Button onClick={onClose} sx={{textTransform: 'none'}}>{t('common.close')}</Button>
        }
      </DialogActions>
    </Dialog>
  )
}

// No notice: a neutral title, the API's detail and Close, and nothing asked of
// a connected service.
const FallbackDialog = ({open, onClose, detail, errorCode, capability}) => {
  const { t } = useTranslation()
  useNoticeEvents(open, errorCode, capability)
  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle sx={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5}}>
        {t('limit_notice.fallback_title')}
        <CloseIconButton onClick={onClose} aria-label={t('common.close')} sx={{mt: -0.5, mr: -1, ml: 'auto'}} />
      </DialogTitle>
      <DialogContent sx={{px: 0, pb: 0}}>
        <Typography variant='body1' sx={{my: 2}}>{detail || t('unknown_error')}</Typography>
      </DialogContent>
      <DialogActions disableSpacing sx={{p: 0, pt: 3, justifyContent: 'flex-end'}}>
        <Button onClick={onClose} sx={{textTransform: 'none'}}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  )
}

const Strip = ({notice, detail, onDismiss, sx}) => {
  const { t } = useTranslation()
  const colours = toneOf(getNoticeTone(notice))
  const frame = {display: 'flex', gap: 1.5, alignItems: 'flex-start', backgroundColor: colours.bg, borderBottom: '1px solid', borderColor: colours.border, px: 2, py: 1, ...sx}
  if(!notice)
    return detail ? (
      <Box role='status' sx={{...frame, alignItems: 'center', py: 0.75}}>
        <InfoOutlinedIcon sx={{color: colours.main, fontSize: '21px'}} />
        <Typography sx={{fontSize: '13.5px', color: 'surface.contrastText'}}>{detail}</Typography>
      </Box>
    ) : null
  const text = [notice.restricted, notice.still_works, notice.managed_by].filter(Boolean).join(' ')
  const actions = orderActions(notice.actions, 'strip')
  return (
    <Box role='status' sx={frame}>
      <NoticeIcon notice={notice} sx={{color: colours.main, fontSize: '21px', mt: '1px'}} />
      <Box sx={{flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px'}}>
        <Box sx={{display: 'flex', alignItems: 'center', columnGap: 1.5, rowGap: 0.75, flexWrap: 'wrap'}}>
          {notice.title && <Typography component='span' sx={{fontWeight: 600, fontSize: '14px', color: 'surface.dark'}}>{notice.title}</Typography>}
          {notice.scope && <Typography component='span' sx={{fontSize: '12.5px', color: 'secondary.main'}}>{notice.scope}</Typography>}
          {
            notice.meter &&
              <Box component='span' sx={{display: 'inline-flex', alignItems: 'center', gap: 1}}>
                <Bar meter={notice.meter} tone={getNoticeTone(notice)} height={6} sx={{width: 120}} />
                {notice.meter.label && <Typography component='span' sx={{fontSize: '12.5px', fontWeight: 500, color: 'surface.dark'}}>{notice.meter.label}</Typography>}
              </Box>
          }
          {notice.reset && <Typography component='span' sx={{fontSize: '12.5px', color: 'surface.contrastText'}}>{notice.reset}</Typography>}
        </Box>
        {text && <Typography sx={{fontSize: '13.5px', lineHeight: 1.45, color: 'surface.contrastText'}}>{text}</Typography>}
        {
          (actions.length > 0 || notice.help) &&
            <Box sx={{display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mt: '3px'}}>
              {actions.map((action, i) => <ActionButton key={i} action={action} size='small' />)}
              {notice.help && <HelpLink help={notice.help} sx={{ml: 0.5}} />}
            </Box>
        }
      </Box>
      {
        notice.dismissible && onDismiss &&
          <IconButton size='small' aria-label={t('common.close')} onClick={onDismiss} sx={{mt: -0.5, mr: -1}}>
            <CloseIcon fontSize='small' />
          </IconButton>
      }
    </Box>
  )
}

const Inline = ({notice, detail, sx}) => {
  const colours = toneOf(getNoticeTone(notice))
  const frame = {display: 'flex', gap: 1.5, alignItems: 'flex-start', backgroundColor: colours.bg, border: '1px solid', borderColor: colours.border, borderRadius: '12px', px: 1.75, py: 1.5, ...sx}
  if(!notice)
    return detail ? (
      <Box role='status' sx={frame}>
        <InfoOutlinedIcon sx={{color: colours.main, fontSize: '22px'}} />
        <Typography sx={{fontSize: '13.5px', color: 'surface.contrastText'}}>{detail}</Typography>
      </Box>
    ) : null
  const actions = orderActions(notice.actions, 'inline')
  return (
    <Box role='status' sx={frame}>
      <NoticeIcon notice={notice} sx={{color: colours.main, fontSize: '22px'}} />
      <Box sx={{flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1, fontSize: '13.5px', lineHeight: 1.45, color: 'surface.contrastText'}}>
        {notice.title && <Typography sx={{fontWeight: 600, fontSize: '14.5px', lineHeight: 1.35, color: 'surface.dark'}}>{notice.title}</Typography>}
        <Scope notice={notice} sx={{fontSize: '12.5px', mt: -0.5}} />
        <Meter notice={notice} labelSize='13px' />
        <Reset notice={notice} />
        <Rows notice={notice} />
        {
          (actions.length > 0 || notice.help) &&
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap'}}>
              {actions.map((action, i) => <ActionButton key={i} action={action} size='small' />)}
              {notice.help && <HelpLink help={notice.help} />}
            </Box>
        }
      </Box>
    </Box>
  )
}

// size: 'dialog' (with open and onClose), 'strip' or 'inline'.
const LimitNotice = ({size = 'dialog', notice, detail, open, onClose, onDismiss, errorCode, capability, sx}) => {
  if(size === 'strip')
    return <Strip notice={notice} detail={detail} onDismiss={onDismiss} sx={sx} />
  if(size === 'inline')
    return <Inline notice={notice} detail={detail} sx={sx} />
  if(notice)
    return <NoticeDialog open={Boolean(open)} onClose={onClose} notice={notice} errorCode={errorCode} capability={capability} />
  return <FallbackDialog open={Boolean(open)} onClose={onClose} detail={detail} errorCode={errorCode} capability={capability} />
}

export default LimitNotice
