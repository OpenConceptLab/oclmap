import React from 'react';
import { useTranslation } from 'react-i18next'
import LoaderDialog from '../common/LoaderDialog'

const CheckAuth = () => {
  const { t } = useTranslation()
  return (
    <div style={{display: 'flex', height: 'calc(var(--app-height) - 100px)', alignItems: 'center', justifyContent: 'center', textAlign: 'center', flexDirection: 'column'}}>
      <LoaderDialog open message={t('common.checking_auth')}/>
    </div>
  )
}

export default CheckAuth;
