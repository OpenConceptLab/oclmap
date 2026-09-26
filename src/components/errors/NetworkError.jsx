import React from 'react';
import { useTranslation } from 'react-i18next'

const NetworkError = () => {
  const { t } = useTranslation()
  return (
    <div style={{display: 'flex', height: 'calc(var(--app-height) - 100px)', alignItems: 'center', justifyContent: 'center', textAlign: 'center', flexDirection: 'column'}}>
      <div className='col-xs-12'>
        <p style={{color: '#000', fontSize: '24px', margin: '16px 0'}}>
          {t('errors.network_error')}
        </p>
      </div>
    </div>
  )
}

export default NetworkError;
