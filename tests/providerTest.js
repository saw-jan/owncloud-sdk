describe('provider testing', () => {
  const { VerifierV3 } = require('@pact-foundation/pact/v3')
  const chai = require('chai')
  const chaiAsPromised = require('chai-as-promised')
  const path = require('path')

  chai.use(chaiAsPromised)

  it('verifies the provider', async () => {
    const opts = {
      provider: 'oc-server',
      logLevel: 'DEBUG',
      providerBaseUrl: process.env.PROVIDER_BASE_URL || 'http://localhost/',
      disableSSLVerification: true
    }
    if (process.env.CI === 'true') {
      opts.pactBrokerUrl = 'https://jankaritech.pactflow.io'
      opts.publishVerificationResult = true
      opts.pactBrokerToken = process.env.PACTFLOW_TOKEN
      opts.consumerVersionSelectors = [
        {
          tag: process.env.DRONE_SOURCE_BRANCH,
          latest: true
        }
      ]
      opts.providerVersion = process.env.PROVIDER_VERSION
    } else {
      opts.pactUrls = [path.resolve(process.cwd(), 'tests', 'pacts', 'owncloud-sdk-oc-server.json')]
    }
    await new VerifierV3(opts).verifyProvider().catch(function (error) {
      chai.assert.fail(error.message)
    })
  }, 60000)
})
