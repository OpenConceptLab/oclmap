import React from 'react';
import SvgIcon from '@mui/material/SvgIcon';
import { useTranslation } from 'react-i18next'

const NoResults = ({searchedText, height, text, graphicWidth}) => {
  const { t } = useTranslation()
  return (
    <div className='col-xs-12' style={{display: 'flex', height: height, alignItems: 'center', justifyContent: 'center', textAlign: 'center', flexDirection: 'column'}}>
      <SvgIcon style={{width: graphicWidth || "236px", height: graphicWidth ? "auto" : "139px", aspectRatio: "236 / 139", fill: "none"}} viewBox="0 0 236 139">
        <g clipPath="url(#6uor9l0n4a)" stroke="#5E5C71" strokeMiterlimit="10" strokeDasharray="3 3">
          <path d="M46.41 138.721c25.477 0 46.13-20.661 46.13-46.147 0-25.487-20.653-46.148-46.13-46.148C20.932 46.426.279 67.087.279 92.574c0 25.486 20.653 46.147 46.13 46.147zM128.815 91.52C108.071 87.003 92.54 68.532 92.54 46.426c0-23.244 17.181-42.478 39.53-45.679M228.963 39.673c9.008-9.012 9.008-23.623 0-32.635-9.009-9.012-23.615-9.012-32.624 0-9.008 9.012-9.008 23.623 0 32.635 9.009 9.012 23.615 9.012 32.624 0zM175.319 65.712c7.841-10.046 6.056-24.547-3.987-32.39-10.042-7.843-24.538-6.058-32.378 3.988s-6.055 24.548 3.987 32.39c10.042 7.844 24.538 6.058 32.378-3.988zM211.351 105.293c4.21-12.025-2.123-25.188-14.144-29.4-12.021-4.21-25.179 2.124-29.389 14.15-4.21 12.026 2.123 25.188 14.144 29.4 12.021 4.211 25.179-2.124 29.389-14.15z"/>
        </g>
        <defs>
          <clipPath id="6uor9l0n4a">
            <path fill="#fff" d="M0 0h236v139H0z"/>
          </clipPath>
        </defs>
      </SvgIcon>
      <div className='col-xs-12' style={{marginTop: '16px'}}>
        {
          text ? text : <>{t('search.no_results')} <b>{searchedText}</b>.</>
        }
    </div>
    </div>
  )
}

export default NoResults;
