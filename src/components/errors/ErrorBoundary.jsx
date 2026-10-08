/*eslint no-process-env: 0*/
import React from 'react';
import StackTrace from "stacktrace-js";
import { Notifier } from '@airbrake/browser';
import { map, isString } from 'lodash';
import { getCurrentUser, getEnv } from '../../common/utils';
import ErrorUI from './ErrorUI';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  getNotifier = () => {
    /*eslint no-undef: 0*/
    this.ERRBIT_KEY = window.ERRBIT_KEY || process.env.ERRBIT_KEY
    /*eslint no-undef: 0*/
    this.ERRBIT_URL = window.ERRBIT_URL || process.env.ERRBIT_URL
    if(this.ERRBIT_URL && this.ERRBIT_KEY)
      return new Notifier({
        projectId: 1,
        projectKey: this.ERRBIT_KEY,
        environment: getEnv(),
        host: this.ERRBIT_URL
      })
  }

  componentDidCatch(error, errorInfo) {
    this.setState({error: error, errorInfo: errorInfo, hasError: Boolean(error)}, () => {
      StackTrace.fromError(this.state.error).then(traces => {
        const newTraces = map(traces, trace => ({
          column: trace.columnNumber,
          file: trace.fileName,
          'function': trace.functionName,
          line: trace.lineNumber
        }));
        const notifier = this.getNotifier()
        if(notifier) {
          const user = getCurrentUser() || {};
          notifier.addFilter(notice => {
            notice.errors[0].backtrace = newTraces;
            return notice;
          });
          notifier.notify({
            error: this.state.error,
            params: {info: this.state.errorInfo},
            context: {
              component: window.location.href, user: {id: user.id, email: user.email}
            }
          });
        }
      })
    })
  }

  getErrorUIProps() {
    const props = {header: 'Error', message: isString(this.state.error) ? this.state.error : 'Something went wrong.'}

    if(window.location.search.match(/debug=true/))
      return {...props, error: this.state.error, errorInfo: this.state.errorInfo}

    return props
  }

  render() {
    const props = this.getErrorUIProps()
    const { hasError } = this.state;
    return hasError ? <ErrorUI {...props} /> : this.props.children;
  }
}

export default ErrorBoundary;
