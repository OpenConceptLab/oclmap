import React from 'react';
import { useTranslation } from 'react-i18next'

const formatTime = totalSeconds => {
  const safeSeconds = Math.max(totalSeconds, 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const getLimitMessage = (t, limitType) => {
  if(limitType === 'minute')
    return t('errors.throttled.limit_hit.minute');
  if(limitType === 'day')
    return t('errors.throttled.limit_hit.day');
  if(limitType === 'minute_and_day')
    return t('errors.throttled.limit_hit.minute_and_day');

  return t('errors.throttled.limit_hit.unknown');
}

const ThrottlingError = ({
  retryAfter = 0,
  limitType = 'unknown',
  onExpire,
}) => {
  const { t } = useTranslation()
  const [secondsLeft, setSecondsLeft] = React.useState(Math.max(retryAfter, 0))

  React.useEffect(() => {
    setSecondsLeft(Math.max(retryAfter, 0))
  }, [retryAfter])

  React.useEffect(() => {
    if(retryAfter <= 0 && onExpire)
      onExpire()
  }, [retryAfter, onExpire])

  React.useEffect(() => {
    if(secondsLeft <= 0)
      return undefined;

    const timer = window.setInterval(() => {
      setSecondsLeft(currentSeconds => {
        if(currentSeconds <= 1) {
          window.clearInterval(timer)
          if(onExpire)
            onExpire()
          return 0;
        }

        return currentSeconds - 1;
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [secondsLeft])

  return (
    <div style={{position: 'fixed', inset: 0, zIndex: 1400, background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', flexDirection: 'column', padding: '24px'}}>
      <div className='col-xs-12' style={{maxWidth: '560px'}}>
        <p style={{color: '#000', fontSize: '24px', margin: '16px 0'}}>
          {t('errors.throttled.title')}
        </p>
        <p style={{color: '#333', fontSize: '16px', margin: '0 0 12px'}}>
          {getLimitMessage(t, limitType)}
        </p>
        <p style={{color: '#333', fontSize: '16px', margin: '0 0 12px'}}>
          {t('errors.throttled.retry_after')}
        </p>
        <p style={{color: '#000', fontSize: '36px', fontWeight: 700, margin: '0'}}>
          {formatTime(secondsLeft)}
        </p>
      </div>
    </div>
  )
}

export default ThrottlingError;
