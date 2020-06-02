/* eslint-env jest */
import HubSpot from '../src/hubspot'
import Express from 'express'
import _ from 'lodash'
import axios from 'axios'

jest.setTimeout(64000)

const hs = new HubSpot({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: process.env.REDIRECT,
  scope: process.env.SCOPE
})

describe('hubspot api', () => {
  test('basic test', async (done) => {
    const app = new Express()
    app.get('/', async (req, res) => {
      const { code } = req.query
      console.log(code, req.query)
      await hs.authorize({ code })
      console.log(hs)
      expect(_.isPlainObject(hs.token())).toBe(true)
      expect(_.isNumber(hs.userInfo.user_id)).toBe(true)
      let r = await hs.get('/contacts/v1/lists/recently_updated/contacts/recent')
      r = r.data
      expect(_.isArray(r.contacts)).toBe(true)
      // r = await hs.post('/contacts/v1/contact', {
      //   dd: 'sdf'
      // })
      // console.log(r)
      done()
    })
    app.listen(process.env.PORT, 'localhost', () => {
      console.log('server runs on', `http://localhost:${process.env.PORT}`)
      const url = hs.authorizeUri()
      console.log(url)
      axios.get(url)
    })
  })
})
