import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCustomer,
  fetchChannelContents,
  fetchPostBySlug,
  fetchPosts,
  fetchProduct,
  fetchProducts,
  fetchWorkBySlug,
  fetchWorks,
} from "~/server/adapter";
import { HttpError } from "@tom/types/errors";

const fetchMock = vi.fn();

const jsonResponse = <T>(body: T, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse({}));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("server functions", () => {
  describe("fetchPosts", () => {
    it("calls the adapter posts endpoint with pagination and returns the unwrapped payload", async () => {
      const payload = { data: [{ id: 34 }], meta: { pagination: { page: 1 } } };
      fetchMock.mockResolvedValue(jsonResponse(payload));
      const result = await fetchPosts(2, 5);
      expect(result).toEqual(payload);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8788/payload/posts?page=2&pageSize=5",
        expect.anything(),
      );
    });
  });

  describe("fetchPostBySlug", () => {
    it("calls the adapter post endpoint with the slug", async () => {
      const post = { id: "34", title: "A pattern language" };
      fetchMock.mockResolvedValue(jsonResponse(post));
      const result = await fetchPostBySlug("a-pattern-language");
      expect(result).toEqual(post);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8788/payload/posts/a-pattern-language",
        expect.anything(),
      );
    });

    it("throws an HttpError carrying the adapter status and message", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ error: "Not found" }, 404));
      try {
        await fetchPostBySlug("missing");
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect(error).toMatchObject({ status: 404, message: "Not found" });
      }
    });
  });

  describe("fetchWorks", () => {
    it("calls the adapter works endpoint", async () => {
      const works = [{ id: 1, title: "Hyperjam" }];
      fetchMock.mockResolvedValue(jsonResponse(works));
      const result = await fetchWorks();
      expect(result).toEqual(works);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8788/payload/works",
        expect.anything(),
      );
    });
  });

  describe("fetchWorkBySlug", () => {
    it("calls the adapter work endpoint with the slug", async () => {
      const work = { id: "1", title: "Hyperjam" };
      fetchMock.mockResolvedValue(jsonResponse(work));
      const result = await fetchWorkBySlug("hyperjam");
      expect(result).toEqual(work);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8788/payload/works/hyperjam",
        expect.anything(),
      );
    });
  });

  describe("fetchProducts", () => {
    it("calls the adapter products endpoint", async () => {
      const products = [{ id: "prod_1" }];
      fetchMock.mockResolvedValue(jsonResponse(products));
      const result = await fetchProducts();
      expect(result).toEqual(products);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8788/polar/products",
        expect.anything(),
      );
    });
  });

  describe("fetchProduct", () => {
    it("calls the adapter product endpoint with the id", async () => {
      const product = { id: "prod_1" };
      fetchMock.mockResolvedValue(jsonResponse(product));
      const result = await fetchProduct("prod_1");
      expect(result).toEqual(product);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8788/polar/products/prod_1",
        expect.anything(),
      );
    });
  });

  describe("createCustomer", () => {
    it("posts the customer to the adapter", async () => {
      const customer = { id: "cust_1" };
      fetchMock.mockResolvedValue(jsonResponse(customer));
      const result = await createCustomer({ email: "tom@example.com", externalId: "uuid-1" });
      expect(result).toEqual(customer);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8788/polar/customers",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "tom@example.com", externalId: "uuid-1" }),
        }),
      );
    });
  });

  describe("fetchChannelContents", () => {
    it("calls the adapter arena channel contents endpoint", async () => {
      const contents = { data: [{ id: 1 }] };
      fetchMock.mockResolvedValue(jsonResponse(contents));
      const result = await fetchChannelContents("tom", 10);
      expect(result).toEqual(contents);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8788/arena/channels/tom/contents?per=10",
        expect.anything(),
      );
    });
  });
});
