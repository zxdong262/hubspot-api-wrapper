import axios from 'axios'
import URI from 'urijs'
import EventEmitter from 'events'

const version = process.env.version

class HTTPError extends Error {
  constructor (status, statusText, data, config) {
    super(`status: ${status}
statusText: ${statusText}
data: ${JSON.stringify(data, null, 2)}
config: ${JSON.stringify(config, null, 2)}`)
    this.status = status
    this.statusText = statusText
    this.data = data
    this.config = config
  }
}

class HubSpot extends EventEmitter {
  constructor ({
    clientId,
    clientSecret,
    server = 'https://api.hubapi.com',
    redirectUri,
    token,
    userInfo = {},
    scope = '',
    appServer = 'https://app.hubspot.com',
    axiosInstance
  }) {
    super()
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.server = server
    this.userInfo = userInfo
    this.appServer = appServer
    this.redirectUri = redirectUri
    this.scope = scope
    this._token = token
    this._axios = axiosInstance || axios.create()
    const request = this._axios.request.bind(this._axios)
    this._axios._request = async config => { // do not try to refresh token
      try {
        return await request(config)
      } catch (e) {
        if (e.response) {
          throw new HTTPError(e.response.status, e.response.statusText, e.response.data, e.response.config)
        }
        throw e
      }
    }
    this._axios.request = async config => { // try to refresh token if necessary
      try {
        return await request(config)
      } catch (e) {
        if (e.response) {
          if ((e.response.data.errors || []).some(error => /\expired\b/i.test(error.message))) { // access token expired
            try {
              console.log(e.response.data)
              await this.refresh()
              config.headers = { ...config.headers, ...this._bearerAuthorizationHeader() }
              return await request(config)
            } catch (e) {
              if (e.response) {
                throw new HTTPError(e.response.status, e.response.statusText, e.response.data, e.response.config)
              }
              throw e
            }
          }
          throw new HTTPError(e.response.status, e.response.statusText, e.response.data, e.response.config)
        }
        throw e
      }
    }
  }

  token (_token) {
    if (arguments.length === 0) { // get
      return this._token
    }
    const tokenChanged = this._token !== _token
    this._token = _token
    if (tokenChanged) {
      this.emit('tokenChanged', _token)
    }
  }

  async authorize ({ code }) {
    let data = await this.getAuthToken({
      code
    })
    this.token(data)
  }

  async refresh () {
    if (this._token === undefined) {
      return
    }
    if (!this.refreshRequest) {
      this.refreshRequest = this.getAuthToken({
        refreshToken: this._token.refresh_token
      })
    }
    const r = await this.refreshRequest
    this.token(r)
    this.refreshRequest = undefined
  }

  async getAuthToken ({
    code,
    refreshToken
  }) {
    const url = `${this.server}/oauth/v1/token`
    const data = (
      code
        ? 'grant_type=authorization_code'
        : 'grant_type=refresh_token'
    ) +
    `&client_id=${this.clientId}&` +
    `client_secret=${this.clientSecret}&` +
    `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
      (
        code
          ? `code=${code}`
          : `refresh_token=${refreshToken}`
      )

    const res = await this._axios.request({
      method: 'post',
      url,
      data,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
      }
    })

    /**
    {
      "access_token": "xxxx",
      "refresh_token": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
      "expires_in": 21600
    }
    */
    if (!this.userInfo.user_id) {
      await this.getUserInfo(res.data.access_token)
    }
    return res.data
  }

  async getUserInfo (accessToken = this._token.access_token) {
    const r = await this._axios.request({
      method: 'get',
      url: this.server + '/oauth/v1/access-tokens/' + accessToken
    })
    this.userInfo = r.data
    return r.data
  }

  async revoke () {
    if (this._token === undefined) {
      return
    }
    this.token(undefined)
  }

  authorizeUri (options = {}) {
    return URI(this.appServer).path('/oauth/authorize')
      .search({
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        response_type: options.responseType || 'code',
        state: options.state || '',
        scope: options.scope || this.scope
      }).toString()
  }

  request (config) {
    let urls = config.url.split('?')
    let p = urls[0]
    let q = urls[1] || ''
    let uri = URI(p)
    if (uri.hostname() === '') {
      uri = URI(this.server).path(p)
    }
    let url = q ? uri.toString() + '?' + q : uri.toString()
    return this._axios.request({
      ...config,
      url,
      headers: this._patchHeaders(config.headers)
    })
  }

  get (url, config = {}) {
    return this.request({ ...config, method: 'get', url })
  }

  delete (url, config = {}) {
    return this.request({ ...config, method: 'delete', url })
  }

  post (url, data = undefined, config = {}) {
    return this.request({ ...config, method: 'post', url, data })
  }

  put (url, data = undefined, config = {}) {
    return this.request({ ...config, method: 'put', url, data })
  }

  patch (url, data = undefined, config = {}) {
    return this.request({ ...config, method: 'patch', url, data })
  }

  _patchHeaders (headers) {
    const userAgentHeader = `hubspot-api-wrapper/v${version}`
    return {
      ...this._bearerAuthorizationHeader(),
      'X-User-Agent': userAgentHeader,
      'RC-User-Agent': userAgentHeader,
      ...headers
    }
  }

  _bearerAuthorizationHeader () {
    let accessToken = ''
    if (this._token) {
      accessToken = this._token.access_token
    }
    return { Authorization: `Bearer ${accessToken}` }
  }
}

export default HubSpot
