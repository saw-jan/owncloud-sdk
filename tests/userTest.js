fdescribe('Main: Currently testing user management,', function () {
  var OwnCloud = require('../src/owncloud')
  var config = require('./config/config.json')

  // LIBRARY INSTANCE
  var oc

  // PACT setup
  const Pact = require('@pact-foundation/pact-web')
  const provider = new Pact.PactWeb()
  const { setGeneralInteractions } = require('./pactHelper.js')

  beforeAll(function (done) {
    Promise.all(setGeneralInteractions(provider)).then(done, done.fail)
  })

  afterAll(function (done) {
    provider.removeInteractions().then(done, done.fail)
  })

  beforeEach(function (done) {
    oc = new OwnCloud({
      baseUrl: config.owncloudURL,
      auth: {
        basic: {
          username: config.username,
          password: config.password
        }
      }
    })

    oc.login().then(status => {
      expect(status).toEqual({ id: 'admin', 'display-name': 'admin', email: {} })
      done()
    })
  })

  afterEach(function () {
    oc.logout()
    oc = null
  })

  describe('added testUser to testGroup,', function () {
    it('checking method : getUserGroups with an existent user', function (done) {
      oc.users.getUserGroups(config.testUser).then(data => {
        expect(typeof (data)).toEqual('object')
        expect(data.indexOf(config.testGroup)).toBeGreaterThan(-1)
        done()
      }).catch(error => {
        expect(error).toBe(null)
        done()
      })
    })

    it('checking method : userIsInGroup with an existent user, existent group', function (done) {
      oc.users.userIsInGroup(config.testUser, config.testGroup).then(status => {
        expect(status).toBe(true)
        done()
      }).catch(error => {
        expect(error).toBe(null)
        done()
      })
    })
  })

  describe('made testUser as testGroup subAdmin', function () {
    it('checking method : getUserSubadminGroups with an existent user', function (done) {
      oc.users.getUserSubadminGroups(config.testUser).then(data => {
        expect(typeof (data)).toEqual('object')
        expect(data.indexOf(config.testGroup)).toBeGreaterThan(-1)
        done()
      }).catch(error => {
        expect(error).toBe(null)
        done()
      })
    })
  })

  it('checking method : getUser on an existent user', function (done) {
    oc.users.getUser(config.username).then(data => {
      expect(typeof (data)).toEqual('object')
      expect(data.displayname).toEqual(config.username)
      done()
    }).catch(error => {
      expect(error).toBe(null)
      done()
    })
  })

  it('checking method : getUser on a non existent user', function (done) {
    oc.users.getUser(config.nonExistentUser).then(user => {
      expect(user).toBe(null)
      done()
    }).catch(error => {
      expect(error).toBe('The requested user could not be found')
      done()
    })
  })

  it('checking method : createUser & deleteUser', function (done) {
    oc.users.createUser(config.testUser, config.testUserPassword).then(data => {
      expect(data).toEqual(true)
      return oc.users.deleteUser(config.testUser)
    }).then(status => {
      expect(status).toBe(true)
      done()
    }).catch(error => {
      expect(error).toBe(null)
      done()
    })
  })

  it('checking method : createUser with groups', function (done) {
    oc.users.createUser(config.testUser, config.testUserPassword, [config.testGroup]).then((data) => {
      expect(data).toEqual(true)
      return oc.users.userIsInGroup(config.testUser, config.testGroup)
    }).then((status) => {
      expect(status).toBe(true)
      return oc.users.deleteUser(config.testUser)
    }).then((status) => {
      expect(status).toBe(true)
      done()
    }).catch((error) => {
      expect(error).toBe(null)
      done()
    })
  })

  it('checking method : disableUser & enableUser', function (done) {
    var testUserOc = new OwnCloud({
      baseUrl: config.owncloudURL,
      auth: {
        basic: {
          username: config.testUser,
          password: config.testUserPassword
        }
      }
    })

    oc.users.disableUser(config.testUser).then(status => {
      expect(status).toBe(true)
      return testUserOc.login()
    }).then(() => {
      fail()
      done()
    }).catch(error => {
      expect(error).toMatch('Unauthorised')
      return oc.users.enableUser(config.testUser)
    }).then((status) => {
      expect(status).toBe(true)
      return testUserOc.login()
    }).then(() => {
      testUserOc.logout()
      testUserOc = null
      done()
    }).catch(() => {
      fail()
      done()
    })
  })

  it('checking method : searchUsers', function (done) {
    oc.users.searchUsers('').then(data => {
      expect(typeof (data)).toEqual('object')
      expect(data.indexOf(config.username)).toBeGreaterThan(-1)
      expect(data.indexOf(config.testUser)).toBeGreaterThan(-1)
      done()
    }).catch(error => {
      expect(error).toBe(null)
      done()
    })
  })

  it('checking method : searchUsers with zero user results', function (done) {
    oc.users.searchUsers(config.nonExistentUser).then(data => {
      expect(typeof (data)).toEqual('object')
      expect(data.length).toEqual(0)
      done()
    }).catch(error => {
      expect(error).toBe(null)
      done()
    })
  })

  it('checking method : userExists with existent user', function (done) {
    oc.users.userExists(config.username).then(status => {
      expect(status).toBe(true)
      done()
    }).catch(error => {
      expect(error).toBe(null)
      done()
    })
  })

  it('checking method : userExists with non existent user', function (done) {
    oc.users.userExists(config.nonExistentUser).then(status => {
      expect(status).toBe(false)
      done()
    }).catch(error => {
      expect(error).toBe(null)
      done()
    })
  })

  it('checking method : setUserAttribute of an existent user, allowed attribute', function (done) {
    oc.users.setUserAttribute(config.testUser, 'email', 'asd@a.com').then(data => {
      expect(data).toEqual(true)
      return oc.users.getUser(config.testUser)
    }).then(user => {
      expect(typeof (user)).toEqual('object')
      expect(user.email).toEqual('asd@a.com')
      done()
    }).catch(error => {
      expect(error).toBe(null)
      done()
    })
  })

  it('checking method : setUserAttribute of an existent user, not allowed attribute', function (done) {
    oc.users.setUserAttribute(config.testUser, 'email', 'äöüää_sfsdf+$%/)%&=')
      .then(status => {
        expect(status).toBe(null)
        done()
      }).catch(error => {
        // FULL REQUEST RESPONSE RETURNED
        expect(typeof (error)).toBe('object')
        expect(error.ocs.meta.statuscode).toEqual('102')
        done()
      })
  })

  it('checking method : setUserAttribute of a non existent user', function (done) {
    oc.users.setUserAttribute(config.nonExistentUser, 'email', 'asd@a.com').then(status => {
      expect(status).toBe(null)
      done()
    }).catch(error => {
      expect(typeof (error)).toBe('object')
      expect(error.ocs.meta.statuscode).toEqual('997')
      done()
    })
  })

  it('checking method : addUserToGroup with existent user, non existent group', function (done) {
    oc.users.addUserToGroup(config.testUser, config.nonExistentGroup)
      .then(status => {
        expect(status).toBe(null)
        done()
      }).catch(error => {
        // FULL RESPONSE IS RETURNED
        expect(typeof (error)).toBe('object')
        expect(error.ocs.meta.statuscode).toEqual('102')
        done()
      })
  })

  it('checking method : addUserToGroup with non existent user, existent group', function (done) {
    oc.users.addUserToGroup(config.nonExistentUser, config.testGroup).then(status => {
      expect(status).toBe(null)
      done()
    }).catch(error => {
      expect(typeof (error)).toBe('object')
      expect(error.ocs.meta.statuscode).toEqual('102')
      done()
    })
  })

  it('checking method : getUserGroups with a non existent user', function (done) {
    oc.users.getUserGroups(config.nonExistentUser).then(data => {
      expect(typeof (data)).toBe('object')
      expect(data.length).toEqual(0)
      done()
    }).catch(error => {
      expect(typeof (error)).toBe('object')
      expect(error.ocs.meta.statuscode).toEqual('998')
      done()
    })
  })

  it('checking method : userIsInGroup with an existent user but a group the user isn\'t part of', function (done) {
    oc.users.userIsInGroup(config.testUser, 'admin').then(status => {
      expect(status).toEqual(false)
      done()
    }).catch(error => {
      expect(error).toBe(null)
      done()
    })
  })

  it('checking method : userIsInGroup with an existent user, non existent group', function (done) {
    oc.users.userIsInGroup(config.testUser, config.nonExistentGroup)
      .then(status => {
        expect(status).toEqual(false)
        done()
      }).catch(error => {
        expect(error).toBe(null)
        done()
      })
  })

  it('checking method : userIsInGroup with a non existent user', function (done) {
    oc.users.userIsInGroup(config.nonExistentUser, config.testGroup).then(status => {
      expect(status).toBe(null)
      done()
    }).catch(error => {
      expect(typeof (error)).toBe('object')
      expect(error.ocs.meta.statuscode).toEqual('998')
      done()
    })
  })

  it('checking method : getUser with an existent user', function (done) {
    oc.users.getUser(config.testUser).then(data => {
      expect(typeof (data)).toEqual('object')
      expect(data.displayname).toEqual(config.testUser)
      done()
    }).catch(error => {
      expect(error).toBe(null)
      done()
    })
  })

  it('checking method : getUser with a non existent user', function (done) {
    oc.users.getUser(config.nonExistentUser).then(status => {
      expect(status).toBe(true)
      done()
    }).catch(error => {
      expect(error).toEqual('The requested user could not be found')
      done()
    })
  })

  it('checking method : removeUserFromGroup with existent user, non existent group', function (done) {
    oc.users.removeUserFromGroup(config.testUser, config.nonExistentGroup)
      .then(status => {
        expect(status).toBe(null)
        done()
      }).catch(error => {
        expect(typeof (error)).toBe('object')
        expect(error.ocs.meta.statuscode).toEqual('102')
        done()
      })
  })

  it('checking method : removeUserFromGroup with non existent user, existent group', function (done) {
    oc.users.removeUserFromGroup(config.nonExistentUser, config.testGroup)
      .then(status => {
        expect(status).toBe(null)
        done()
      }).catch(error => {
        expect(typeof (error)).toBe('object')
        expect(error.ocs.meta.statuscode).toEqual('102')
        done()
      })
  })

  it('checking method : addUserToSubadminGroup with existent user, non existent group', function (done) {
    oc.users.addUserToSubadminGroup(config.testUser, config.nonExistentGroup)
      .then(status => {
        expect(status).toBe(null)
        done()
      }).catch(error => {
        expect(error).toBe('Group:' + config.nonExistentGroup + ' does not exist')
        done()
      })
  })

  it('checking method : addUserToSubadminGroup with non existent user, existent group', function (done) {
    oc.users.addUserToSubadminGroup(config.nonExistentUser, config.testGroup).then(status => {
      expect(status).toBe(null)
      done()
    }).catch(error => {
      expect(error).toBe('User does not exist')
      done()
    })
  })

  it('checking method : getUserSubadminGroups with a non existent user', function (done) {
    oc.users.getUserSubadminGroups(config.nonExistentUser).then(data => {
      expect(typeof (data)).toBe('object')
      expect(data.length).toEqual(0)
      done()
    }).catch(error => {
      expect(error).toBe('User does not exist')
      done()
    })
  })

  it('checking method : userIsInSubadminGroup with existent user, non existent group', function (done) {
    oc.users.userIsInSubadminGroup(config.testUser, config.nonExistentGroup)
      .then(status => {
        expect(status).toBe(false)
        done()
      }).catch(error => {
        expect(error).toBe(null)
        done()
      })
  })

  it('checking method : userIsInSubadminGroup with non existent user, existent group', function (done) {
    oc.users.userIsInSubadminGroup(config.nonExistentUser, config.testGroup)
      .then(status => {
        expect(status).toBe(null)
        done()
      }).catch(error => {
        expect(error).toBe('User does not exist')
        done()
      })
  })

  it('checking method : deleteUser on a non existent user', function (done) {
    oc.users.deleteUser(config.nonExistentUser).then(status => {
      expect(status).toBe(null)
      done()
    }).catch(error => {
      expect(typeof (error)).toBe('object')
      expect(error.ocs.meta.statuscode).toEqual('101')
      done()
    })
  })
})
