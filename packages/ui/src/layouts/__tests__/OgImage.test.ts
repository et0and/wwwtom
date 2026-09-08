import { describe, expect, it } from "vitest";
import { OgTemplates } from "../OgImage";

describe("sophie template", () => {
  it("circles the final summary word and signs Sophie", () => {
    const html = OgTemplates.sophie({
      title: "Wet",
      summary: "Don't you",
      date: "January 29, 2016",
    });
    expect(html).toContain("Wet");
    expect(html).toContain("font-family: Solway");
    expect(html).toContain("border-radius: 9999px");
    expect(html).toContain(">you</span>");
    expect(html).toContain("January 29, 2016");
    expect(html).toContain("Sophie ©");
  });

  it("escapes HTML in every slot", () => {
    const html = OgTemplates.sophie({
      title: "<b>Wet</b>",
      summary: "Fish & <chips>",
      date: "29 > 28",
    });
    expect(html).toContain("&lt;b&gt;Wet&lt;/b&gt;");
    expect(html).toContain("Fish &amp;");
    expect(html).toContain("&lt;chips&gt;");
    expect(html).toContain("29 &gt; 28");
    expect(html).not.toContain("<b>Wet</b>");
  });

  it("omits the pill for a single-word summary (no leading space)", () => {
    const html = OgTemplates.sophie({ title: "Wet", summary: "Hello", date: "" });
    expect(html).toContain(">Hello</span>");
    expect(html).not.toContain("&nbsp;");
  });

  it("renders no pill for an empty summary", () => {
    const html = OgTemplates.sophie({ title: "Wet", summary: "", date: "" });
    expect(html).not.toContain("border-radius: 9999px");
  });

  it("handles empty title and date gracefully", () => {
    const html = OgTemplates.sophie({ title: "", summary: "Don't you", date: "" });
    expect(html).toContain("Sophie ©");
    expect(html).toContain(">you</span>");
  });

  it("caps corner widths with ellipsis for long text", () => {
    const html = OgTemplates.sophie({
      title: "A very long title that would otherwise blow out the corner",
      summary: "A very long summary that would otherwise blow out the corner",
      date: "January 29, 2016",
    });
    expect(html).toContain("max-width: 55%");
    expect(html).toContain("text-overflow: ellipsis");
  });
});

describe("og template escaping", () => {
  it("escapes title and summary in every template", () => {
    const params = { title: "<Tom> & Co", summary: 'Say "hi" <bye>', date: "D & D" };
    for (const template of [OgTemplates.default, OgTemplates.minimal, OgTemplates.developer]) {
      const html = template(params);
      expect(html).toContain("&lt;Tom&gt; &amp; Co");
      expect(html).toContain("Say &quot;hi&quot; &lt;bye&gt;");
    }
  });
});
