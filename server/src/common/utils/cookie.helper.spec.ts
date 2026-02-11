/**
 * @file Cookie 辅助工具单元测试
 * @description 测试 Cookie 辅助工具的各种场景
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Response } from "express";
import {
  CookieHelper,
  setSecureCookie,
  clearCookie as clearCookieUtil,
} from "./cookie.helper";

// Mock Express Response
const mockResponse = () => {
  const res: Partial<Response> = {
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
  };
  return res as Response;
};

describe("CookieHelper", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.NODE_ENV;
    delete process.env.COOKIE_DOMAIN;
    delete process.env.COOKIE_PATH;
    delete process.env.COOKIE_SECURE;
    delete process.env.COOKIE_SAME_SITE;
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("SPEC: setSecureCookie", () => {
    it("should set cookie with secure options in production", () => {
      process.env.NODE_ENV = "production";
      const res = mockResponse();

      CookieHelper.setSecureCookie(res, "test", "value");

      expect(res.cookie).toHaveBeenCalledWith("test", "value", {
        secure: true,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    });

    it("should set cookie with lax sameSite for session type", () => {
      const res = mockResponse();

      CookieHelper.setSecureCookie(res, "session", "value", "session");

      expect(res.cookie).toHaveBeenCalledWith("session", "value", {
        secure: false,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    });

    it("should set cookie with strict sameSite for persistent type", () => {
      const res = mockResponse();

      CookieHelper.setSecureCookie(res, "persistent", "value", "persistent");

      expect(res.cookie).toHaveBeenCalledWith("persistent", "value", {
        secure: false,
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    });

    it("should allow overriding default options", () => {
      const res = mockResponse();

      CookieHelper.setSecureCookie(res, "test", "value", "session", {
        maxAge: 3600000,
        domain: ".example.com",
      });

      expect(res.cookie).toHaveBeenCalledWith("test", "value", {
        secure: false,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 3600000,
        domain: ".example.com",
      });
    });

    it("should enforce secure=true when sameSite=none", () => {
      const res = mockResponse();

      CookieHelper.setSecureCookie(res, "test", "value", "session", {
        sameSite: "none",
      });

      expect(res.cookie).toHaveBeenCalledWith("test", "value", {
        secure: true,
        httpOnly: true,
        sameSite: "none",
        path: "/",
      });
    });
  });

  describe("SPEC: setSessionCookie", () => {
    it("should set session cookie without maxAge", () => {
      const res = mockResponse();

      CookieHelper.setSessionCookie(res, "session_id", "abc123");

      expect(res.cookie).toHaveBeenCalledWith("session_id", "abc123", {
        secure: false,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    });

    it("should allow custom options for session cookie", () => {
      const res = mockResponse();

      CookieHelper.setSessionCookie(res, "session_id", "abc123", {
        secure: true,
      });

      expect(res.cookie).toHaveBeenCalledWith("session_id", "abc123", {
        secure: true,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    });
  });

  describe("SPEC: setPersistentCookie", () => {
    it("should set persistent cookie with default maxAge", () => {
      const res = mockResponse();

      CookieHelper.setPersistentCookie(res, "refresh_token", "xyz789");

      expect(res.cookie).toHaveBeenCalledWith("refresh_token", "xyz789", {
        secure: false,
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    });

    it("should set persistent cookie with custom maxAge", () => {
      const res = mockResponse();

      CookieHelper.setPersistentCookie(res, "refresh_token", "xyz789", 86400000);

      expect(res.cookie).toHaveBeenCalledWith("refresh_token", "xyz789", {
        secure: false,
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 86400000,
      });
    });

    it("should allow custom options for persistent cookie", () => {
      const res = mockResponse();

      CookieHelper.setPersistentCookie(
        res,
        "refresh_token",
        "xyz789",
        86400000,
        {
          domain: ".example.com",
        },
      );

      expect(res.cookie).toHaveBeenCalledWith("refresh_token", "xyz789", {
        secure: false,
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 86400000,
        domain: ".example.com",
      });
    });
  });

  describe("SPEC: clearCookie", () => {
    it("should clear cookie with default options", () => {
      const res = mockResponse();

      CookieHelper.clearCookie(res, "session_id");

      expect(res.clearCookie).toHaveBeenCalledWith("session_id", {
        domain: undefined,
        path: "/",
        secure: undefined,
        httpOnly: true,
        sameSite: "lax",
      });
    });

    it("should clear cookie with custom domain", () => {
      process.env.COOKIE_DOMAIN = ".example.com";
      const res = mockResponse();

      CookieHelper.clearCookie(res, "session_id");

      expect(res.clearCookie).toHaveBeenCalledWith("session_id", {
        domain: ".example.com",
        path: "/",
        secure: undefined,
        httpOnly: true,
        sameSite: "lax",
      });
    });

    it("should clear cookie with custom options", () => {
      const res = mockResponse();

      CookieHelper.clearCookie(res, "session_id", {
        domain: ".example.com",
        path: "/api",
      });

      expect(res.clearCookie).toHaveBeenCalledWith("session_id", {
        domain: ".example.com",
        path: "/api",
        secure: undefined,
        httpOnly: true,
        sameSite: "lax",
      });
    });

    it("should use strict sameSite in production when clearing", () => {
      process.env.NODE_ENV = "production";
      const res = mockResponse();

      CookieHelper.clearCookie(res, "session_id");

      expect(res.clearCookie).toHaveBeenCalledWith("session_id", {
        domain: undefined,
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "strict",
      });
    });
  });

  describe("SPEC: setAccessTokenCookie", () => {
    it("should set access token cookie with session options", () => {
      const res = mockResponse();

      CookieHelper.setAccessTokenCookie(res, "jwt_token");

      expect(res.cookie).toHaveBeenCalledWith("access_token", "jwt_token", {
        secure: false,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    });
  });

  describe("SPEC: setRefreshTokenCookie", () => {
    it("should set refresh token cookie with persistent options", () => {
      const res = mockResponse();

      CookieHelper.setRefreshTokenCookie(res, "refresh_jwt");

      expect(res.cookie).toHaveBeenCalledWith("refresh_token", "refresh_jwt", {
        secure: false,
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    });

    it("should set refresh token cookie with custom maxAge", () => {
      const res = mockResponse();

      CookieHelper.setRefreshTokenCookie(res, "refresh_jwt", 86400000);

      expect(res.cookie).toHaveBeenCalledWith("refresh_token", "refresh_jwt", {
        secure: false,
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 86400000,
      });
    });
  });

  describe("SPEC: clearAccessTokenCookie", () => {
    it("should clear access token cookie", () => {
      const res = mockResponse();

      CookieHelper.clearAccessTokenCookie(res);

      expect(res.clearCookie).toHaveBeenCalledWith("access_token", {
        domain: undefined,
        path: "/",
        secure: undefined,
        httpOnly: true,
        sameSite: "lax",
      });
    });
  });

  describe("SPEC: clearRefreshTokenCookie", () => {
    it("should clear refresh token cookie", () => {
      const res = mockResponse();

      CookieHelper.clearRefreshTokenCookie(res);

      expect(res.clearCookie).toHaveBeenCalledWith("refresh_token", {
        domain: undefined,
        path: "/",
        secure: undefined,
        httpOnly: true,
        sameSite: "lax",
      });
    });
  });

  describe("SPEC: clearCookies", () => {
    it("should clear multiple cookies", () => {
      const res = mockResponse();

      CookieHelper.clearCookies(res, ["access_token", "refresh_token", "session_id"]);

      expect(res.clearCookie).toHaveBeenCalledTimes(3);
      expect(res.clearCookie).toHaveBeenNthCalledWith(1, "access_token", {
        domain: undefined,
        path: "/",
        secure: undefined,
        httpOnly: true,
        sameSite: "lax",
      });
      expect(res.clearCookie).toHaveBeenNthCalledWith(2, "refresh_token", {
        domain: undefined,
        path: "/",
        secure: undefined,
        httpOnly: true,
        sameSite: "lax",
      });
      expect(res.clearCookie).toHaveBeenNthCalledWith(3, "session_id", {
        domain: undefined,
        path: "/",
        secure: undefined,
        httpOnly: true,
        sameSite: "lax",
      });
    });
  });

  describe("SPEC: getDefaultOptions", () => {
    it("should return default session cookie options", () => {
      const options = CookieHelper.getDefaultOptions("session");

      expect(options).toEqual({
        secure: false,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: undefined,
      });
    });

    it("should return default persistent cookie options", () => {
      const options = CookieHelper.getDefaultOptions("persistent");

      expect(options).toEqual({
        secure: false,
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    });
  });

  describe("SPEC: 生产环境行为", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("should set secure flag in production", () => {
      const res = mockResponse();

      CookieHelper.setSecureCookie(res, "test", "value");

      expect(res.cookie).toHaveBeenCalledWith("test", "value", {
        secure: true,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    });

    it("should use strict sameSite in production", () => {
      const res = mockResponse();

      CookieHelper.setSecureCookie(res, "test", "value", "persistent");

      expect(res.cookie).toHaveBeenCalledWith("test", "value", {
        secure: true,
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    });
  });

  describe("SPEC: 独立工具函数", () => {
    describe("setSecureCookie utility", () => {
      it("should set cookie with secure defaults", () => {
        const res = mockResponse();

        setSecureCookie(res, "test", "value");

        expect(res.cookie).toHaveBeenCalledWith("test", "value", {
          secure: undefined,
          httpOnly: true,
          sameSite: "lax",
          path: "/",
        });
      });

      it("should allow custom options", () => {
        const res = mockResponse();

        setSecureCookie(res, "test", "value", {
          maxAge: 3600000,
          domain: ".example.com",
        });

        expect(res.cookie).toHaveBeenCalledWith("test", "value", {
          secure: undefined,
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 3600000,
          domain: ".example.com",
        });
      });

      it("should enforce secure=true when sameSite=none", () => {
        const res = mockResponse();

        setSecureCookie(res, "test", "value", {
          sameSite: "none",
        });

        expect(res.cookie).toHaveBeenCalledWith("test", "value", {
          secure: true,
          httpOnly: true,
          sameSite: "none",
          path: "/",
        });
      });
    });

    describe("clearCookie utility", () => {
      it("should clear cookie with default options", () => {
        const res = mockResponse();

        clearCookieUtil(res, "test");

        expect(res.clearCookie).toHaveBeenCalledWith("test", {
          domain: undefined,
          path: "/",
          secure: undefined,
          httpOnly: true,
          sameSite: "lax",
        });
      });

      it("should clear cookie with custom options", () => {
        const res = mockResponse();

        clearCookieUtil(res, "test", {
          domain: ".example.com",
          path: "/api",
        });

        expect(res.clearCookie).toHaveBeenCalledWith("test", {
          domain: ".example.com",
          path: "/api",
          secure: undefined,
          httpOnly: true,
          sameSite: "lax",
        });
      });
    });
  });
});
