# hubspot-client

Simple Hubspot api wrapper

## Feature

- Auto renew token
- Only support auth flow

## Use

```js
import HubSpot from 'hubspot-client'

const hs = new HubSpot({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: process.env.REDIRECT,
  scope: process.env.SCOPE
})

...
await hs.authorize({ code })

expect(_.isPlainObject(hs.token())).toBe(true)
expect(_.isNumber(hs.userInfo.id)).toBe(true)
let r = await hs.get('/contacts/v1/lists/recently_updated/contacts/recent')
r = r.data
expect(_.isArray(r.contacts)).toBe(true)

```

## Credits

Based on tyler's [ringcentral-js-concise](https://github.com/tylerlong/ringcentral-js-concise)

## License

MIT
