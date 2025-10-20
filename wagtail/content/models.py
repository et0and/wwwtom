from django.db import models
from wagtail.models import Page
from wagtail.fields import StreamField, RichTextField
from wagtail.images.models import Image as WagtailImage
from wagtail.admin.panels import FieldPanel, StreamFieldPanel
from wagtail.api import APIField
from modelcluster.fields import ParentalKey
from modelcluster.models import ClusterableModel

from .blocks import SharedMediaBlock, SharedQuoteBlock, SharedRichTextBlock, SharedSliderBlock


class Author(Page):
    name = models.CharField(max_length=255)
    avatar = models.ForeignKey(
        WagtailImage,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+'
    )
    email = models.EmailField()

    content_panels = Page.content_panels + [
        FieldPanel('name'),
        FieldPanel('avatar'),
        FieldPanel('email'),
    ]

    api_fields = [
        APIField('name'),
        APIField('avatar'),
        APIField('email'),
    ]

    parent_page_types = ['content.AuthorIndex']
    subpage_types = []


class AuthorIndex(Page):
    max_count = 1

    subpage_types = ['content.Author']


class Category(Page):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)

    content_panels = Page.content_panels + [
        FieldPanel('name'),
        FieldPanel('slug'),
        FieldPanel('description'),
    ]

    api_fields = [
        APIField('name'),
        APIField('slug'),
        APIField('description'),
    ]

    parent_page_types = ['content.CategoryIndex']
    subpage_types = []


class CategoryIndex(Page):
    max_count = 1

    subpage_types = ['content.Category']


class Article(Page):
    title = models.CharField(max_length=255)
    description = models.TextField(max_length=80, blank=True)
    slug = models.SlugField(unique=True)
    cover = models.ForeignKey(
        WagtailImage,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+'
    )
    author = models.ForeignKey(
        Author,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='articles'
    )
    category = models.ForeignKey(
        Category,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='articles'
    )
    blocks = StreamField([
        ('media', SharedMediaBlock()),
        ('quote', SharedQuoteBlock()),
        ('rich_text', SharedRichTextBlock()),
        ('slider', SharedSliderBlock()),
    ], blank=True, use_json_field=True)

    content_panels = Page.content_panels + [
        FieldPanel('title'),
        FieldPanel('description'),
        FieldPanel('slug'),
        FieldPanel('cover'),
        FieldPanel('author'),
        FieldPanel('category'),
        StreamFieldPanel('blocks'),
    ]

    api_fields = [
        APIField('title'),
        APIField('description'),
        APIField('slug'),
        APIField('cover'),
        APIField('author'),
        APIField('category'),
        APIField('blocks'),
    ]

    parent_page_types = ['content.ArticleIndex']
    subpage_types = []


class ArticleIndex(Page):
    max_count = 1

    subpage_types = ['content.Article']


class Post(Page):
    title = models.CharField(max_length=255)
    summary = models.TextField()
    slug = models.SlugField(unique=True)
    content = RichTextField()
    featured_image = models.ForeignKey(
        WagtailImage,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+'
    )
    publication_date = models.DateTimeField(null=True, blank=True)

    content_panels = Page.content_panels + [
        FieldPanel('title'),
        FieldPanel('summary'),
        FieldPanel('slug'),
        FieldPanel('content'),
        FieldPanel('featured_image'),
        FieldPanel('publication_date'),
    ]

    api_fields = [
        APIField('title'),
        APIField('summary'),
        APIField('slug'),
        APIField('content'),
        APIField('featured_image'),
        APIField('publication_date'),
    ]

    parent_page_types = ['content.PostIndex']
    subpage_types = []


class PostIndex(Page):
    max_count = 1

    subpage_types = ['content.Post']


class Work(Page):
    title = models.CharField(max_length=255)
    summary = models.TextField()
    slug = models.SlugField(unique=True)
    content = RichTextField()
    featured_image = models.ForeignKey(
        WagtailImage,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+'
    )
    publication_date = models.DateTimeField(null=True, blank=True)

    content_panels = Page.content_panels + [
        FieldPanel('title'),
        FieldPanel('summary'),
        FieldPanel('slug'),
        FieldPanel('content'),
        FieldPanel('featured_image'),
        FieldPanel('publication_date'),
    ]

    api_fields = [
        APIField('title'),
        APIField('summary'),
        APIField('slug'),
        APIField('content'),
        APIField('featured_image'),
        APIField('publication_date'),
    ]

    parent_page_types = ['content.WorkIndex']
    subpage_types = []


class WorkIndex(Page):
    max_count = 1

    subpage_types = ['content.Work']


class About(Page):
    title = models.CharField(max_length=255, blank=True)
    blocks = StreamField([
        ('media', SharedMediaBlock()),
        ('quote', SharedQuoteBlock()),
        ('rich_text', SharedRichTextBlock()),
        ('slider', SharedSliderBlock()),
    ], blank=True, use_json_field=True)

    content_panels = Page.content_panels + [
        FieldPanel('title'),
        StreamFieldPanel('blocks'),
    ]

    api_fields = [
        APIField('title'),
        APIField('blocks'),
    ]

    max_count = 1
    parent_page_types = ['wagtailcore.Page']
    subpage_types = []


class GlobalSettings(ClusterableModel):
    site_name = models.CharField(max_length=255)
    favicon = models.ForeignKey(
        WagtailImage,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+'
    )
    site_description = models.TextField()
    default_seo_meta_title = models.CharField(max_length=255, blank=True)
    default_seo_meta_description = models.TextField(blank=True)
    default_seo_share_image = models.ForeignKey(
        WagtailImage,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+'
    )

    panels = [
        FieldPanel('site_name'),
        FieldPanel('favicon'),
        FieldPanel('site_description'),
        FieldPanel('default_seo_meta_title'),
        FieldPanel('default_seo_meta_description'),
        FieldPanel('default_seo_share_image'),
    ]

    class Meta:
        verbose_name = 'Global Settings'


# Register as snippet
from wagtail.snippets.models import register_snippet
register_snippet(GlobalSettings)
