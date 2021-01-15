import { MatchersV3, PactV3, XmlBuilder } from '@pact-foundation/pact/v3'
import { Matchers } from '@pact-foundation/pact'
const config = require('./config/config.json')
var validUserPasswordHash = Buffer.from(config.username + ':' + config.password, 'binary').toString('base64')

const path = require('path')
const OwnCloud = require('../src/owncloud')

const accessControlAllowHeaders = 'OC-Checksum,OC-Total-Length,OCS-APIREQUEST,X-OC-Mtime,Accept,Authorization,Brief,Content-Length,Content-Range,Content-Type,Date,Depth,Destination,Host,If,If-Match,If-Modified-Since,If-None-Match,If-Range,If-Unmodified-Since,Location,Lock-Token,Overwrite,Prefer,Range,Schedule-Reply,Timeout,User-Agent,X-Expected-Entity-Length,Accept-Language,Access-Control-Request-Method,Access-Control-Allow-Origin,ETag,OC-Autorename,OC-CalDav-Import,OC-Chunked,OC-Etag,OC-FileId,OC-LazyOps,OC-Total-File-Length,Origin,X-Request-ID,X-Requested-With'
const accessControlAllowMethods = 'GET,OPTIONS,POST,PUT,DELETE,MKCOL,PROPFIND,PATCH,PROPPATCH,REPORT,COPY,MOVE,HEAD,LOCK,UNLOCK'
const origin = 'http://localhost:9876'
const validAuthHeaders = {
  authorization: 'Basic ' + validUserPasswordHash
}

const testSubFiles = [
  `${config.testFolder}/abc.txt`,
  `${config.testFolder}/file one.txt`,
  `${config.testFolder}/subdir/in dir.txt`,
  `${config.testFolder}/zz+z.txt`,
  `${config.testFolder}/中文.txt`
]

const uriEncodedTestSubFiles = testSubFiles.map(item => encodeURIComponent(item).split('%2F').join('/'))

const ocsMeta = function (status, statusCode, Message = null) {
  if (Message == null) {
    return ' <meta>\n' +
      '  <status>' + status + '</status>\n' +
      '  <statuscode>' + statusCode + '</statuscode>\n' +
      '  <message/>\n' +
      ' </meta>\n'
  }
  return ' <meta>\n' +
    '  <status>' + status + '</status>\n' +
    '  <statuscode>' + statusCode + '</statuscode>\n' +
    '  <message>' + Message + '</message>\n' +
    ' </meta>\n'
}

const shareResponseOcsData = function (shareType, id, permissions, fileTarget) {
  const data = '  <id>' + id + '</id>\n' +
    '  <share_type>' + shareType + '</share_type>\n' +
    '  <uid_owner>admin</uid_owner>\n' +
    '  <displayname_owner>admin</displayname_owner>\n' +
    '  <permissions>' + permissions + '</permissions>\n' +
    '  <uid_file_owner>admin</uid_file_owner>\n' +
    '  <displayname_file_owner>admin</displayname_file_owner>\n' +
    '  <path>' + fileTarget + '</path>\n' +
    '  <file_target>' + fileTarget + '</file_target>\n'

  if (shareType === 3) {
    return data +
      '  <url>' + config.owncloudURL + '/s/yrkoLeS33y1aTya</url>\n'
  }
  return data
}

const applicationXmlResponseHeaders = {
  'Content-Type': 'application/xml; charset=utf-8'
}

const xmlResponseHeaders = {
  'Content-Type': 'text/xml; charset=utf-8'
}

const invalidAuthHeader = Matchers.term({
  matcher: '^(?!Basic ' + validUserPasswordHash + ').*$', // match anything except a valid auth
  generate: 'Basic bm9uRXhpc3RpbmdVc2VycnByeXJxOHg2OmNvbmZpZy5wYXNzd29yZHJwcnlycTh4Ng=='
})

const unauthorizedXmlResponseBody = '<?xml version="1.0"?>\n' +
  '<ocs>\n' +
  ' <meta>\n' +
  '  <status>failure</status>\n' +
  '  <statuscode>997</statuscode>\n' +
  '  <message>Unauthorised</message>\n' +
  ' </meta>\n' +
  ' <data/>\n' +
  '</ocs>'

const xmlResponseAndAccessControlCombinedHeader = {
  ...applicationXmlResponseHeaders,
  'Access-Control-Allow-Headers': accessControlAllowHeaders,
  'Access-Control-Allow-Methods': accessControlAllowMethods
}

const htmlResponseAndAccessControlCombinedHeader = {
  'Content-Type': 'text/html; charset=utf-8',
  'Access-Control-Allow-Headers': accessControlAllowHeaders,
  'Access-Control-Allow-Methods': accessControlAllowMethods
}

const resourceNotFoundExceptionMessage = resource => `File with name ${resource} could not be located`

const webdavMatcherForResource = resource => {
  if (resource.includes('/')) {
    return resource.split('/').join('\\/') + '$'
  } else {
    return resource + '$'
  }
}

const webdavExceptionResponseBody = (exception, message) => '<?xml version="1.0" encoding="utf-8"?>\n' +
  '<d:error xmlns:d="DAV:" xmlns:s="http://sabredav.org/ns">\n' +
  `  <s:exception>Sabre\\DAV\\Exception\\${exception}</s:exception>\n` +
  `  <s:message>${message}</s:message>\n` +
  '</d:error>'

const webdavPath = resource => Matchers.regex({
  matcher: '.*\\/remote\\.php\\/webdav\\/' + webdavMatcherForResource(resource),
  generate: `/remote.php/webdav/${resource}`
})

const createProvider = function () {
  return new PactV3({
    consumer: 'owncloud-sdk',
    provider: 'oc-server',
    port: 1234,
    dir: path.resolve(process.cwd(), 'tests', 'pacts')
  })
}

const createOwncloud = function (username = config.username, password = config.password) {
  const oc = new OwnCloud({
    baseUrl: config.owncloudURL,
    auth: {
      basic: {
        username,
        password
      }
    }
  })
  return oc
}

const getContentsOfFile = file => {
  return {
    uponReceiving: 'GET contents of file ' + file,
    withRequest: {
      method: 'GET',
      path: webdavPath(file),
      headers: validAuthHeaders
    },
    willRespondWith: file !== config.nonExistentFile ? {
      status: 200,
      headers: xmlResponseAndAccessControlCombinedHeader,
      body: config.testContent
    } : {
      status: 404,
      headers: xmlResponseAndAccessControlCombinedHeader,
      body: webdavExceptionResponseBody('NotFound', resourceNotFoundExceptionMessage(config.nonExistentFile))
    }
  }
}

const deleteResource = (resource, type = 'folder') => {
  return {
    uponReceiving: `a request to delete a ${type},  ${resource}`,
    withRequest: {
      method: 'DELETE',
      path: webdavPath(resource),
      headers: validAuthHeaders
    },
    willRespondWith: resource.includes('nonExistent') ? {
      status: 404,
      headers: xmlResponseAndAccessControlCombinedHeader,
      body: webdavExceptionResponseBody('NotFound', resourceNotFoundExceptionMessage(config.nonExistentDir))
    } : (function (type) {
      if (type === 'file') {
        return {
          status: 200,
          headers: xmlResponseHeaders,
          body: '<?xml version="1.0"?>\n' +
            '<ocs>\n' +
            ocsMeta('ok', '100') +
            ' <data/>\n' +
            '</ocs>'
        }
      } else {
        return {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': origin
          }
        }
      }
    }())
  }
}

async function GETRequestToCloudUserEndpoint (provider) {
  await provider
    .uponReceiving('a GET request to the cloud user endpoint')
    .withRequest({
      method: 'GET',
      path: MatchersV3.regex(
        /.*\/ocs\/v(1|2)\.php\/cloud\/user$/,
        '/ocs/v1.php/cloud/user'
      ),
      headers: validAuthHeaders
    })
    .willRespondWith({
      status: 200,
      headers: applicationXmlResponseHeaders,
      body: new XmlBuilder('1.0', '', 'ocs').build(ocs => {
        ocs.appendElement('meta', '', (meta) => {
          meta.appendElement('status', '', 'ok')
            .appendElement('statuscode', '', '100')
            .appendElement('message', '', 'OK')
        }).appendElement('data', '', (data) => {
          data.appendElement('id', '', 'admin')
          data.appendElement('display-name', '', MatchersV3.string('admin'))
          data.appendElement(
            'email',
            '',
            MatchersV3.regex(/((^(?![\s\S]))|(\w+@\w+\.\w+))/, 'admin@example.com')
            // empty string or email
          )
        })
      })
    })
}

async function capabilitiesGETRequestValidAuth (provider) {
  await provider
    .uponReceiving('a capabilities GET request with valid authentication')
    .withRequest({
      method: 'GET',
      path: MatchersV3.regex(
        /.*\/ocs\/v(1|2)\.php\/cloud\/capabilities/,
        '/ocs/v1.php/cloud/capabilities'
      ),
      query: { format: 'json' },
      headers: validAuthHeaders
    })
    .willRespondWith({
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: {
        ocs: {
          meta: {
            status: 'ok',
            statuscode: 100,
            message: 'OK'
          },
          data: {
            version: {
              major: MatchersV3.integer(10),
              minor: MatchersV3.integer(5),
              micro: MatchersV3.integer(1),
              string: MatchersV3.string('10.5.1alpha1'),
              edition: MatchersV3.string('Enterprise')
            },
            capabilities: {
              files: {
                privateLinks: true,
                privateLinksDetailsParam: true,
                bigfilechunking: true,
                blacklisted_files: [
                  '.htaccess'
                ],
                favorites: true,
                file_locking_support: true,
                file_locking_enable_file_action: false,
                undelete: true,
                versioning: true
              },
              dav: {
                trashbin: '1.0'
              }
            }
          }
        }
      }
    })
}

const GETSingleUserEndpoint = function () {
  return {
    uponReceiving: 'a single user GET request to the cloud users endpoint',
    withRequest: {
      method: 'GET',
      path: Matchers.term({
        matcher: '.*\\/ocs\\/v2\\.php\\/cloud\\/users\\/.+',
        generate: '/ocs/v2.php/cloud/users/' + config.testUser
      }),
      query: 'format=json',
      headers: validAuthHeaders
    },
    willRespondWith: {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': origin
      },
      body: {
        ocs: {
          meta: {
            status: 'ok',
            statuscode: 200,
            message: null
          },
          data: {
            email: 'foo@bar.net'
          }
        }
      }
    }
  }
}

const capabilitiesGETRequestInvalidAuth = function () {
  return {
    uponReceiving: 'a capabilities GET request with invalid authentication',
    withRequest: {
      method: 'GET',
      path: Matchers.term({
        matcher: '.*\\/ocs\\/v(1|2)\\.php\\/cloud\\/capabilities',
        generate: '/ocs/v1.php/cloud/capabilities'
      }),
      query: 'format=json',
      headers: {
        authorization: invalidAuthHeader,
        Origin: origin
      }
    },
    willRespondWith: {
      status: 401,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': origin
      },
      body: {
        ocs: {
          meta: {
            status: 'failure',
            statuscode: 997,
            message: 'Unauthorised'
          }
        }
      }
    }
  }
}

const createAUser = function () {
  return {
    uponReceiving: 'a create user request',
    withRequest: {
      method: 'POST',
      path: Matchers.regex({
        matcher: '.*\\/ocs\\/v(1|2)\\.php\\/cloud\\/users',
        generate: '/ocs/v1.php/cloud/users'
      }),
      headers: validAuthHeaders,
      body: 'password=' + config.testUser + '&userid=' + config.testUser
    },
    willRespondWith: {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin
      }
    }
  }
}

const createAUserWithGroupMembership = function () {
  return {
    uponReceiving: 'a create user request including group membership',
    withRequest: {
      method: 'POST',
      path: Matchers.term({
        matcher: '.*\\/ocs\\/v1\\.php\\/cloud\\/users',
        generate: '/ocs/v1.php/cloud/users'
      }),
      headers: validAuthHeaders,
      body: 'password=' + config.testUserPassword + '&userid=' + config.testUser + '&groups%5B0%5D=' + config.testGroup
    },
    willRespondWith: {
      status: 200,
      headers: xmlResponseHeaders,
      body: '<?xml version="1.0"?>\n' +
        '<ocs>\n' +
        ocsMeta('ok', '100') +
        '  <data/>\n' +
        '</ocs>\n'
    }
  }
}

const deleteAUser = function () {
  return {
    uponReceiving: 'a request to delete a user',
    withRequest: {
      method: 'DELETE',
      path: Matchers.term({
        matcher: '.*\\/ocs\\/v1\\.php\\/cloud\\/users\\/' + config.testUser + '$',
        generate: '/ocs/v1.php/cloud/users/' + config.testUser
      }),
      headers: validAuthHeaders
    },
    willRespondWith: {
      status: 200,
      headers: xmlResponseHeaders,
      body: '<?xml version="1.0"?>\n' +
        '<ocs>\n' +
        ocsMeta('ok', '100') +
        '  <data/>\n' +
        '</ocs>\n'
    }
  }
}

const createAFolder = function () {
  return {
    uponReceiving: 'successfully create a folder',
    withRequest: {
      method: 'MKCOL',
      path: Matchers.term({
        // accept any request to testfolder and any subfolders except notExistentDir
        matcher: '.*\\/remote\\.php\\/webdav\\/' + config.testFolder + '\\/(?!' + config.nonExistentDir + ').*\\/?',
        generate: '/remote.php/webdav/' + config.testFolder + '/'
      }),
      headers: validAuthHeaders
    },
    willRespondWith: {
      status: 201,
      headers: htmlResponseAndAccessControlCombinedHeader
    }
  }
}

const updateFile = function (file) {
  return {
    uponReceiving: 'Put file contents to file ' + file,
    withRequest: {
      method: 'PUT',
      path: webdavPath(file),
      headers: validAuthHeaders,
      body: config.testContent
    },
    willRespondWith: file.includes('nonExistent') ? {
      status: 404,
      headers: {
        'Access-Control-Allow-Origin': origin
      },
      body: webdavExceptionResponseBody('NotFound', resourceNotFoundExceptionMessage(config.nonExistentDir))
    } : {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin
      }
    }
  }
}

function setGeneralInteractions (provider) {
  const promises = []

  promises.push(provider.addInteraction(capabilitiesGETRequestValidAuth()))
  promises.push(provider.addInteraction(capabilitiesGETRequestInvalidAuth()))
  promises.push(provider.addInteraction(GETRequestToCloudUserEndpoint()))
  promises.push(provider.addInteraction(GETSingleUserEndpoint()))
  promises.push(provider.addInteraction(createAUser()))
  promises.push(provider.addInteraction(createAUserWithGroupMembership()))
  promises.push(provider.addInteraction(deleteAUser()))
  promises.push(provider.addInteraction(createAFolder()))

  let files = ['test.txt', '%E6%96%87%E4%BB%B6.txt', 'test%20space%20and%20%2B%20and%20%23.txt', 'newFileCreated123', config.testFile]
  for (const file of files) {
    promises.push(provider.addInteraction(deleteResource(file, 'file')))
  }

  files = [
    'test.txt', '%E6%96%87%E4%BB%B6.txt', 'test%20space%20and%20%2B%20and%20%23.txt',
    config.testFile, config.testFolder + '/' + config.testFile,
    ...uriEncodedTestSubFiles, config.nonExistentDir + '/file.txt'
  ]
  for (const file of files) {
    promises.push(provider.addInteraction(updateFile(file)))
  }
  return promises
}

function pactCleanup (provider) {
  // TODO: uncomment this line after tests are moved to JEST
  // Reason: currently we run the tests on browser runtime.
  // so it makes a cors request
  // Because of that verify() will throw error because the cors request will not be called sometime
  // This maybe because the browser runtime caches the cors info

  // return provider.verify()
  //   .then(() => provider.removeInteractions())

  return provider.removeInteractions()
}

module.exports = {
  setGeneralInteractions,
  getContentsOfFile,
  deleteResource,
  ocsMeta,
  shareResponseOcsData,
  webdavMatcherForResource,
  webdavExceptionResponseBody,
  resourceNotFoundExceptionMessage,
  webdavPath,
  origin,
  validAuthHeaders,
  invalidAuthHeader,
  xmlResponseHeaders,
  applicationXmlResponseHeaders,
  accessControlAllowHeaders,
  accessControlAllowMethods,
  unauthorizedXmlResponseBody,
  xmlResponseAndAccessControlCombinedHeader,
  testSubFiles,
  uriEncodedTestSubFiles,
  htmlResponseAndAccessControlCombinedHeader,
  capabilitiesGETRequestValidAuth,
  GETRequestToCloudUserEndpoint,
  GETSingleUserEndpoint,
  createOwncloud,
  createProvider,
  capabilitiesGETRequestInvalidAuth,
  createAUser,
  createAUserWithGroupMembership,
  deleteAUser,
  createAFolder,
  updateFile,
  pactCleanup
}
