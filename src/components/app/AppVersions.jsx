/*eslint no-process-env: 0*/

import React from 'react';
import { withTranslation } from 'react-i18next';
import { Tooltip, Divider } from '@mui/material';
import APIService from '../../services/APIService';
import { isFHIRServer, toFullAPIURL } from '../../common/utils';
import packageJson from '../../../package.json';
import config from '../../../config.json';
import { COLORS } from '../../common/colors'

const VERSION = `${packageJson.version}-${config.build}`
const SWAGGER_URL = toFullAPIURL('/swagger/')

const AppVersionChip = ({version, label, tooltip}) => {
  return (
    <Tooltip title={tooltip || label} arrow>
      <span className='app-version-container'>
        <span className='app-label'>
          {label}
        </span>
        <span className='app-version'>{version}</span>
      </span>
    </Tooltip>
  )
}

class AppVersions extends React.Component {
  constructor(props) {
    super(props)
    this.state = {version: null}
  }
  componentDidMount() {
    if(!isFHIRServer())
      APIService
      .version()
      .get()
      .then(response => this.setState({version: response.status === 200 ? response.data : null}))
  }

  render() {
    const { t } = this.props
    return (
      <React.Fragment>
        <AppVersionChip tooltip={t('app.web_version')} label='MAP-' version={VERSION} />
        {
          this.state.version &&
            <React.Fragment>
              <Divider orientation='vertical' className='footer-divider-vertical' />

              <a href={SWAGGER_URL} target='_blank' rel="noopener noreferrer" style={{color: COLORS.primary.main}}>
                <AppVersionChip tooltip={t('app.api_version')} label='API-' version={this.state.version} />
              </a>
            </React.Fragment>
        }
      </React.Fragment>
    )
  }
}

export default withTranslation()(AppVersions);
