import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const postRoot = "_posts";
const outputRoot = "content/images/generated";
const manifestPath = "_data/responsive_images.json";
const targetWidths = [320, 640, 960, 1280, 1920];

const findPostFilesAsync = async (directory) =>
{
    const entries = await readdir(directory, { withFileTypes: true });
    const nestedFiles = await Promise.all(entries.map(async (entry) =>
    {
        const entryPath = path.join(directory, entry.name);

        if (entry.isDirectory())
        {
            return findPostFilesAsync(entryPath);
        }

        return entry.isFile() && entry.name.endsWith(".md") ? [entryPath] : [];
    }));

    return nestedFiles.flat();
};

const getPostImagesAsync = async (postPath) =>
{
    const post = await readFile(postPath, "utf8");
    const frontMatter = post.match(/^---\s*\n([\s\S]*?)\n---/);
    const images = [];

    if (frontMatter)
    {
        const headerImage = frontMatter[1].match(/^image:\s*["']?([^"'\r\n]+?)["']?\s*$/m);

        if (headerImage)
        {
            images.push(headerImage[1]);
        }
    }

    const figurePattern = /{%\s*include\s+figure\.html\s+[^%]*filename=["']([^"']+)["'][^%]*%}/g;

    for (const figure of post.matchAll(figurePattern))
    {
        const extension = path.extname(figure[1]).toLowerCase();

        if ([".jpg", ".jpeg", ".png", ".webp"].includes(extension))
        {
            images.push(path.join("content/images", figure[1]));
        }
    }

    return images;
};

const getOrientedDimensions = (metadata) =>
{
    const swapsDimensions = [5, 6, 7, 8].includes(metadata.orientation);

    return {
        width: swapsDimensions ? metadata.height : metadata.width,
        height: swapsDimensions ? metadata.width : metadata.height
    };
};

const getVariantWidths = (sourceWidth) =>
{
    const maximumWidth = Math.min(sourceWidth, targetWidths.at(-1));
    return [...new Set([...targetWidths.filter((width) => width < maximumWidth), maximumWidth])];
};

const generateImageAsync = async (sourcePath) =>
{
    await stat(sourcePath);

    const image = sharp(sourcePath);
    const metadata = await image.metadata();
    const dimensions = getOrientedDimensions(metadata);

    if (!dimensions.width || !dimensions.height)
    {
        throw new Error(`Could not read the dimensions of ${sourcePath}.`);
    }

    const sourceName = path.parse(sourcePath).name;
    const variants = [];

    for (const width of getVariantWidths(dimensions.width))
    {
        const outputPath = path.join(outputRoot, `${sourceName}-${width}.webp`);

        await sharp(sourcePath)
            .rotate()
            .resize({ width, withoutEnlargement: true })
            .webp({ quality: 82, effort: 4 })
            .toFile(outputPath);

        variants.push({
            path: `/${outputPath}`,
            width
        });
    }

    return {
        width: dimensions.width,
        height: dimensions.height,
        variants
    };
};

const mainAsync = async () =>
{
    const postFiles = await findPostFilesAsync(postRoot);
    const postImages = await Promise.all(postFiles.map(getPostImagesAsync));
    const imagePaths = [...new Set(postImages.flat())].sort();

    await rm(outputRoot, { recursive: true, force: true });
    await mkdir(outputRoot, { recursive: true });
    await mkdir(path.dirname(manifestPath), { recursive: true });

    const manifestEntries = await Promise.all(imagePaths.map(async (imagePath) =>
    {
        const responsiveImage = await generateImageAsync(imagePath);
        return [imagePath, responsiveImage];
    }));

    const manifest = Object.fromEntries(manifestEntries);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const variantCount = manifestEntries.reduce(
        (count, [, responsiveImage]) => count + responsiveImage.variants.length,
        0);

    process.stdout.write(`Generated ${variantCount} responsive variants for ${imagePaths.length} images.\n`);
};

await mainAsync();
