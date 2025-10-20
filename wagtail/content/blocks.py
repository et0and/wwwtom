from wagtail import blocks
from wagtail.images.blocks import ImageChooserBlock
from wagtail.documents.blocks import DocumentChooserBlock


class SharedMediaBlock(blocks.StructBlock):
    file = blocks.StreamBlock([
        ('image', ImageChooserBlock()),
        ('document', DocumentChooserBlock()),
        ('video', blocks.URLBlock()),  # Assuming video is URL
    ])

    class Meta:
        icon = 'media'


class SharedQuoteBlock(blocks.StructBlock):
    title = blocks.CharBlock(required=False)
    body = blocks.TextBlock()

    class Meta:
        icon = 'openquote'


class SharedRichTextBlock(blocks.StructBlock):
    body = blocks.RichTextBlock()

    class Meta:
        icon = 'doc-full'


class SharedSliderBlock(blocks.StructBlock):
    files = blocks.ListBlock(ImageChooserBlock())

    class Meta:
        icon = 'image'


class SEOBlock(blocks.StructBlock):
    meta_title = blocks.CharBlock()
    meta_description = blocks.TextBlock()
    share_image = ImageChooserBlock(required=False)

    class Meta:
        icon = 'search'
