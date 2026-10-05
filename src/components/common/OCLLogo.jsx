import React from 'react';
import SvgIcon from '@mui/material/SvgIcon';
import { PRIMARY_COLORS } from '../../common/colors'

const OCLLogo = ({ color, width, height, }) => {
  return (
    <a className='hover-no-bg-color flex-vertical-center' href='/'>
      <SvgIcon sx={{color: 'primary.main', fill: color || PRIMARY_COLORS.main, width: width || '84px', height: height || '28px'}} href='/'>
        <svg version="1.1" id="Layer_1" x="0px" y="0px" viewBox="0 0 306.14 111.63">
          <g>
	          <g>
	            <circle className="st0" cx="54.09" cy="55.33" r="54.09"/>
	          </g>
	          <g>
	            <path className="st0" d="M177.31,109.42c-29.87,0-54.09-24.22-54.09-54.09s24.22-54.09,54.09-54.09"/>
	          </g>
	          <g>
	            <g>
	              <circle className="st0" cx="222.74" cy="28.04" r="27.04"/>
	            </g>
	            <g>
	              <circle className="st0" cx="222.74" cy="84.4" r="27.04"/>
	            </g>
	            <g>
	              <circle className="st0" cx="279.1" cy="84.4" r="27.04"/>
	            </g>
	          </g>
          </g>
        </svg>
      </SvgIcon>
    </a>
  )
}

export default OCLLogo;
