// std
import { deepStrictEqual, notStrictEqual, ok, strictEqual } from 'assert';
import { URLSearchParams } from 'url';

// 3p
import { ConfigMock, Context, createApp, createService, Get, HttpResponseBadRequest, HttpResponseOK, isHttpResponseRedirect } from '@foal/core';

// FoalTS
import { AbstractProvider, AuthorizationError, InvalidStateError, SocialTokens, TokenError } from './abstract-provider.service';

const STATE_COOKIE_NAME = 'oauth2-state';

describe('AbstractProvider', () => {

  class ConcreteProvider extends AbstractProvider {
    protected configPaths = {
      clientId: 'settings.social.example.clientId',
      clientSecret: 'settings.social.example.clientSecret',
      redirectUri: 'settings.social.example.redirectUri'
    };
    protected authEndpoint = 'https://example2.com/auth';
    protected tokenEndpoint = 'http://localhost:3000/token';
    getUserFromTokens(tokens: SocialTokens) {
      throw new Error('Method not implemented.');
    }
  }

  let provider: ConcreteProvider;
  let configInstance: ConfigMock;
  const clientId = 'clientIdXXX';
  const clientSecret = 'clientSecretYYY';
  const redirectUri = 'https://example.com/callback';

  before(() => {
    configInstance = new ConfigMock();
    configInstance.set('settings.social.example.clientId', clientId);
    configInstance.set('settings.social.example.clientSecret', clientSecret);
    configInstance.set('settings.social.example.redirectUri', redirectUri);

    provider = createService(ConcreteProvider, { configInstance });
  });

  describe('has a "redirect" method that', () => {

    it('should return an HttpResponseRedirect object.', async () => {
      const result = await provider.redirect();
      strictEqual(isHttpResponseRedirect(result), true);
    });

    describe('should return an HttpResponseRedirect object', () => {

      it('with a redirect path which contains a client ID, a response type, a redirect URI.', async () => {
        const response = await provider.redirect();
        ok(response.path.startsWith(
          'https://example2.com/auth?'
          + 'response_type=code&'
          + 'client_id=clientIdXXX&'
          + 'redirect_uri=https%3A%2F%2Fexample.com%2Fcallback'
        ));
      });

      it('with a redirect path which does not contain a scope if none was provided.', async () => {
        const response = await provider.redirect();
        const searchParams = new URLSearchParams(response.path);

        strictEqual(searchParams.get('scope'), null);
      });

      it('with a redirect path which contains the scopes if any are provided by the class.', async () => {
        class ConcreteProvider2 extends ConcreteProvider {
          defaultScopes = [ 'scope1', 'scope2' ];
        }
        provider = createService(ConcreteProvider2, { configInstance });

        const response = await provider.redirect();
        const searchParams = new URLSearchParams(response.path);

        strictEqual(searchParams.get('scope'), 'scope1 scope2');
      });

      it('with a redirect path which contains the scopes if any are provided by the class'
          + ' (custom separator).', async () => {
        class ConcreteProvider2 extends ConcreteProvider {
          defaultScopes = [ 'scope1', 'scope2' ];
          scopeSeparator = ',';
        }
        provider = createService(ConcreteProvider2, { configInstance });

        const response = await provider.redirect();
        const searchParams = new URLSearchParams(response.path);

        strictEqual(searchParams.get('scope'), 'scope1,scope2');
      });

      it('with a redirect path which contains the scopes if any are provided to the method.', async () => {
        class ConcreteProvider2 extends ConcreteProvider {
          // This checks that the default scopes will be override.
          defaultScopes = [ 'scope1', 'scope2' ];
        }
        provider = createService(ConcreteProvider2, { configInstance });

        const response = await provider.redirect({
          scopes: [ 'scope3', 'scope4' ]
        });
        const searchParams = new URLSearchParams(response.path);

        strictEqual(searchParams.get('scope'), 'scope3 scope4');
      });

      it('with a generated state to protect against CSRF attacks.', async () => {
        const response = await provider.redirect();
        const stateCookieValue = response.getCookie(STATE_COOKIE_NAME).value;
        if (typeof stateCookieValue !== 'string') {
          throw new Error('Cookie not found.');
        }

        const searchParams = new URLSearchParams(response.path);
        const stateParamValue = searchParams.get('state');
        if (typeof stateParamValue !== 'string') {
          throw new Error('State parameter not found.');
        }

        strictEqual(stateParamValue, stateCookieValue);
        notStrictEqual(stateCookieValue.length, 0);
      });

      it('with a redirect path which contains extra parameters if any are provided by the class.', async () => {
        class ConcreteProvider2 extends ConcreteProvider {
          baseAuthEndpointParams = {
            foo: 'bar'
          };
        }
        provider = createService(ConcreteProvider2, { configInstance });

        const response = await provider.redirect();
        const searchParams = new URLSearchParams(response.path);

        strictEqual(searchParams.get('foo'), 'bar');
      });

      it('with a redirect path which contains extra parameters if any are provided to the method.', async () => {
        class ConcreteProvider2 extends ConcreteProvider {
          baseAuthEndpointParams = {
            // This checks that the base params will be extended.
            foo: 'bar',
            foobar: 'barfoo'
          };
        }
        provider = createService(ConcreteProvider2, { configInstance });

        const response = await provider.redirect({
          params: { foo: 'bar2' }
        });
        const searchParams = new URLSearchParams(response.path);

        strictEqual(searchParams.get('foo'), 'bar2');
        strictEqual(searchParams.get('foobar'), 'barfoo');
      });

    });

  });

  describe('has a "getTokens" method that', () => {

    class ConcreteProvider2 extends ConcreteProvider {
      baseTokenEndpointParams = {
        foo: 'bar'
      };
    }
    let server;

    before(() => {
      provider = createService(ConcreteProvider2, { configInstance });
    });

    afterEach(() => {
      if (server) {
        server.close();
      }
    });

    it('should throw an InvalidStateError if the query param "state" is not equal '
        + 'to the cookie state value.', async () => {
      const ctx = new Context({
        cookies: {
          [STATE_COOKIE_NAME]: 'xxx'
        },
        query: {},
      });
      try {
        await provider.getTokens(ctx);
        throw new Error('getTokens should have thrown an InvalidStateError.');
      } catch (error) {
        if (!(error instanceof InvalidStateError)) {
          throw error;
        }
      }
    });

    it('should throw an AuthorizationError if the request contains a query param "error".', async () => {
      const ctx = new Context({
        cookies: {
          [STATE_COOKIE_NAME]: 'xxx'
        },
        query: {
          error: 'access_denied',
          error_description: 'yyy',
          error_uri: 'zzz',
          state: 'xxx',
        },
      });
      try {
        await provider.getTokens(ctx);
        throw new Error('getTokens should have thrown an AuthorizationError.');
      } catch (error) {
        if (!(error instanceof AuthorizationError)) {
          throw error;
        }
        strictEqual(error.error, 'access_denied');
        strictEqual(error.errorDescription, 'yyy');
        strictEqual(error.errorUri, 'zzz');
      }
    });

    it('should send a request which contains a grant type, a code, a redirect URI,'
      + 'a client ID, a client secret and custom params and return the response body.', async () => {
      class AppController {
        @Get('/token')
        token(ctx: Context) {
          const { grant_type, code, redirect_uri, client_id, client_secret, foo } = ctx.request.query;
          strictEqual(grant_type, 'authorization_code');
          strictEqual(code, 'an_authorization_code');
          strictEqual(redirect_uri, redirectUri);
          strictEqual(client_id, clientId);
          strictEqual(client_secret, clientSecret);
          strictEqual(foo, 'bar');
          return new HttpResponseOK({
            accessToken: 'an_access_token',
            tokenType: 'bearer'
          });
        }
      }

      server = createApp(AppController).listen(3000);

      const ctx = new Context({
        cookies: {
          [STATE_COOKIE_NAME]: 'xxx'
        },
        query: {
          code: 'an_authorization_code',
          state: 'xxx',
        },
      });

      const actual = await provider.getTokens(ctx);
      const expected: SocialTokens = {
        accessToken: 'an_access_token',
        tokenType: 'bearer'
      };
      deepStrictEqual(actual, expected);
    });

    it('should throw a TokenError if the token endpoint returns an error.', async () => {
      class AppController {
        @Get('/token')
        token(ctx: Context) {
          return new HttpResponseBadRequest({
            error: 'bad request'
          });
        }
      }

      server = createApp(AppController).listen(3000);

      const ctx = new Context({
        cookies: {
          [STATE_COOKIE_NAME]: 'xxx'
        },
        query: {
          code: 'an_authorization_code',
          state: 'xxx',
        },
      });

      try {
        await provider.getTokens(ctx);
        throw new Error('getTokens should have thrown a TokenError.');
      } catch (error) {
        if (!(error instanceof TokenError)) {
          throw error;
        }
        deepStrictEqual(error.error, {
          error: 'bad request'
        });
      }
    });

  });

});
