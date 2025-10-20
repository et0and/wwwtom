from wagtail.models import Page


class HomePage(Page):
    max_count = 1

    subpage_types = ['content.AuthorIndex', 'content.CategoryIndex', 'content.ArticleIndex', 'content.PostIndex', 'content.WorkIndex', 'content.About']

    class Meta:
        verbose_name = "Home Page"
