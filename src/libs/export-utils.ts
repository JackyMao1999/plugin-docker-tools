import { exportMdContent, getFileBlob } from "../api";

const DEFAULT_OPTIONS: ExportOptions = {
    pageSize: "A4",
    orientation: "portrait",
    marginTop: 15,
    marginBottom: 15,
    marginLeft: 20,
    marginRight: 20,
    fontFamily: "Noto Serif CJK SC, Source Han Serif SC, serif",
    fontSize: 11,
    lineHeight: 1.8,
    codeFontSize: 9,
    showToc: false,
    pageHeader: true,
    pageFooter: true,
    customCSS: "",
};

function getPageDimensions(pageSize: string, orientation: string): [number, number] {
    const sizes: Record<string, [number, number]> = {
        "A3": [297, 420],
        "A4": [210, 297],
        "A5": [148, 210],
        "Letter": [216, 279],
        "Legal": [216, 356],
        "B5": [176, 250],
    };
    let [w, h] = sizes[pageSize] || sizes["A4"];
    if (orientation === "landscape") {
        [w, h] = [h, w];
    }
    return [w, h];
}

async function inlineImages(element: HTMLElement): Promise<void> {
    const imgs = element.querySelectorAll("img");
    const promises: Promise<void>[] = [];
    imgs.forEach((img) => {
        const src = img.getAttribute("src");
        if (!src || src.startsWith("data:")) return;
        const promise = (async () => {
            try {
                const blob = await getFileBlob(src);
                if (blob) {
                    const dataUrl = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                    img.setAttribute("src", dataUrl);
                }
            } catch (e) {
                console.warn("Failed to inline image:", src, e);
            }
        })();
        promises.push(promise);
    });
    await Promise.all(promises);
}

function renderMarkdown(markdown: string, title: string, options: ExportOptions): string {
    const Lute = (window as any).Lute;
    let html = "";
    if (Lute) {
        const lute = Lute.New();
        html = lute.Md2HTML(markdown);
    } else {
        html = "<pre>" + markdown + "</pre>";
    }
    const tocHtml = options.showToc ? '<nav class="toc"><h1>Table of Contents</h1><ul id="toc-list"></ul></nav>' : "";
    return (
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + title +
        '</title><style>' + getPrintCSS(options) + '</style></head><body>' +
        '<div class="export-wrapper">' +
        (options.pageHeader ? '<header class="export-header"><h1 class="doc-title">' + title + '</h1></header>' : "") +
        tocHtml +
        '<main class="export-content">' + html + '</main>' +
        (options.pageFooter ? '<footer class="export-footer"><span class="page-number">Page <span class="page-num"></span></span></footer>' : "") +
        '</div></body></html>'
    );
}

function getPrintCSS(options: ExportOptions): string {
    const [pageW, pageH] = getPageDimensions(options.pageSize, options.orientation);
    return [
        "@page { size: " + pageW + "mm " + pageH + "mm; margin: " + options.marginTop + "mm " + options.marginRight + "mm " + options.marginBottom + "mm " + options.marginLeft + "mm; }",
        "* { box-sizing: border-box; }",
        "body { font-family: " + options.fontFamily + "; font-size: " + options.fontSize + "pt; line-height: " + options.lineHeight + "; color: #333; background: white; }",
        ".export-wrapper { max-width: 100%; padding: 0; }",
        ".export-header { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #333; margin-bottom: 30px; }",
        ".doc-title { font-size: " + (options.fontSize + 8) + "pt; font-weight: bold; margin: 0; color: #000; }",
        ".export-footer { text-align: center; margin-top: 30px; padding-top: 10px; border-top: 1px solid #ccc; font-size: " + (options.fontSize - 2) + "pt; color: #666; }",
        "h1 { font-size: " + (options.fontSize + 6) + "pt; margin-top: 24pt; margin-bottom: 12pt; }",
        "h2 { font-size: " + (options.fontSize + 4) + "pt; margin-top: 20pt; margin-bottom: 10pt; page-break-after: avoid; }",
        "h3 { font-size: " + (options.fontSize + 2) + "pt; margin-top: 16pt; margin-bottom: 8pt; page-break-after: avoid; }",
        "h4, h5, h6 { font-size: " + options.fontSize + "pt; margin-top: 12pt; margin-bottom: 6pt; page-break-after: avoid; }",
        "p { margin: 6pt 0; text-align: justify; }",
        "pre, code { font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace; font-size: " + options.codeFontSize + "pt; }",
        "pre { background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; padding: 10pt; overflow-x: auto; page-break-inside: avoid; white-space: pre-wrap; word-wrap: break-word; }",
        "code { background: #f0f0f0; padding: 1pt 3pt; border-radius: 2pt; } pre code { background: none; padding: 0; }",
        ".token.comment { color: #6a737d; } .token.keyword { color: #d73a49; } .token.string { color: #032f62; } .token.number { color: #005cc5; } .token.function { color: #6f42c1; }",
        "table { width: 100%; border-collapse: collapse; margin: 12pt 0; page-break-inside: auto; }",
        "th, td { border: 1px solid #ccc; padding: 6pt 8pt; text-align: left; } th { background: #f0f0f0; font-weight: bold; }",
        "tr { page-break-inside: avoid; }",
        "img { max-width: 100%; height: auto; page-break-inside: avoid; }",
        "blockquote { border-left: 4px solid #ccc; margin: 10pt 0; padding: 4pt 12pt; color: #555; background: #f9f9f9; }",
        "ul, ol { margin: 6pt 0; padding-left: 24pt; } li { margin: 2pt 0; } hr { border: none; border-top: 1px solid #ccc; margin: 16pt 0; }",
        ".toc { page-break-after: always; margin-bottom: 20pt; }",
        ".toc h1 { font-size: " + (options.fontSize + 6) + "pt; text-align: center; border-bottom: 2px solid #333; padding-bottom: 8pt; }",
        ".toc ul { list-style: none; padding: 0; } .toc li { padding: 2pt 0; }",
        ".toc a { text-decoration: none; color: #333; }",
        "a { color: #0366d6; text-decoration: underline; }",
        ".math { overflow-x: auto; } input[type='checkbox'] { margin-right: 4pt; }",
        "@media print { body { background: white; } .export-footer .page-number:after { content: counter(page); } }",
        options.customCSS || "",
    ].join("\n");
}

export async function printDoc(
    docId: string,
    options: ExportOptions
): Promise<void> {
    const res = await exportMdContent(docId);
    if (!res) {
        throw new Error("exportMdContent returned null for doc " + docId);
    }
    const hPath = res.hPath || "";
    const title = hPath.split("/").pop() || "document";
    const fullHtml = renderMarkdown(res.content || "", title, options);

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
        throw new Error("Failed to open print window");
    }

    printWindow.document.write(fullHtml);
    printWindow.document.title = title;
    printWindow.document.close();

    const printReady = new Promise<void>((resolve) => {
        printWindow.onload = () => {
            const container = printWindow.document.querySelector(".export-wrapper") as HTMLElement;
            if (container) {
                inlineImages(container).then(() => {
                    printWindow.print();
                    resolve();
                }).catch(() => {
                    printWindow.print();
                    resolve();
                });
            } else {
                printWindow.print();
                resolve();
            }
        };
    });

    const timeout = new Promise<void>((resolve) => {
        setTimeout(() => {
            try { printWindow.print(); } catch (e) { void e; }
            resolve();
        }, 3000);
    });

    await Promise.race([printReady, timeout]);
}

export { DEFAULT_OPTIONS };
export type { ExportOptions };
