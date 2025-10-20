from wagtail.api.v2.views import PagesAPIViewSet
from wagtail.api.v2.router import WagtailAPIRouter
from wagtail import hooks

from .models import Author, Category, Article, Post, Work, About, GlobalSettings


# Register API fields for pages
api_router = WagtailAPIRouter('wagtailapi')

# Authors
api_router.register_endpoint('authors', PagesAPIViewSet, base=Author)

# Categories
api_router.register_endpoint('categories', PagesAPIViewSet, base=Category)

# Articles
api_router.register_endpoint('articles', PagesAPIViewSet, base=Article)

# Posts
api_router.register_endpoint('posts', PagesAPIViewSet, base=Post)

# Works
api_router.register_endpoint('works', PagesAPIViewSet, base=Work)

# About
api_router.register_endpoint('about', PagesAPIViewSet, base=About)

# For GlobalSettings, since it's a snippet, Wagtail API v2 supports snippets
# We can access it via /api/v2/snippets/find/?type=content.GlobalSettings
# Or configure to include in pages API if needed.
