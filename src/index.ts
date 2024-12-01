import fs from "fs/promises";

const trailingNewlinesRegex = /(\n+|\r\n+)$/;

export async function zuniq({
  filePath,
  content,
  outputFilePath,
  count,
  repeated,
  unique,
}: {
  filePath?: string;
  content?: string;
  outputFilePath?: string;
  count?: boolean;
  repeated?: boolean;
  unique?: boolean;
}): Promise<{
  out: string;
}> {
  if (repeated && unique) {
    console.warn("Warning: Provide either 'repeated' or 'unique', not both.");
    return { out: "" };
  }

  if (repeated) {
    return processRepeatedLines(filePath, content, count);
  }

  let result = null;
  if (filePath && content) {
    result = await processFilePathAndContent(filePath, content);
  } else if (content) {
    result = { out: await processContent(content) };
  } else {
    await assertFileExists(filePath);
    const fileContent = await fs.readFile(filePath, "utf-8");
    result = { out: await processContent(fileContent) };
  }

  if (count) {
    let rawContent = await getRawContent(filePath, content);
    const linesCount = buildLinesCount(rawContent);
    result.out = await getOutputWithCount(result.out, linesCount);
  }

  if (!outputFilePath) {
    return result;
  }

  await writeToOutputFile(outputFilePath, result.out);

  return result;
}

const processRepeatedLines = async (
  filePath: string,
  content: string,
  count: boolean
): Promise<{ out: string }> => {
  const rawContent = await getRawContent(filePath, content);
  const lines = rawContent.split("\n");
  const linesCount = buildLinesCount(rawContent);
  const repeatedLines = lines.filter((line) => linesCount[line] > 1);
  const out = Array.from(new Set(repeatedLines)).join("\n");

  if (count) {
    return {
      out: await getOutputWithCount(out, linesCount),
    };
  }

  return { out };
};

const getRawContent = async (
  filePath: string,
  content: string
): Promise<string> => {
  let rawContent = "";
  const fileExists = await assertFileExists(filePath)
    .then(() => true)
    .catch(() => false);
  if (fileExists && !content) {
    rawContent = await fs.readFile(filePath, "utf-8");
  } else if (!fileExists && content) {
    console.warn(
      `Warning: Invalid file path '${filePath}'. Using provided content.`
    );
    rawContent = content;
  } else if (fileExists && content) {
    throw new Error("Error: Provide either a file path or content, not both");
  }

  return rawContent;
};

const buildLinesCount = (
  rawContent: string
): {
  [key: string]: number;
} => {
  const lines = rawContent.split("\n");
  const linesCount: {
    [key: string]: number;
  } = {};

  lines.forEach((line) => {
    linesCount[line] = (linesCount[line] || 0) + 1;
  });

  return linesCount;
};

const getOutputWithCount = async (
  rawContent: string,
  linesCount: { [line: string]: number }
): Promise<string> => {
  const outputLines = rawContent.split("\n");
  const outputWithCount = outputLines.map((line) => {
    const count = linesCount[line];
    return `${count} ${line}`;
  });
  return outputWithCount.join("\n");
};

const writeToOutputFile = async (outputFilePath: string, content: string) => {
  const outputFileExists = await assertFileExists(outputFilePath)
    .then(() => true)
    .catch(() => false);

  if (!outputFileExists) {
    const fileCreated = await fs
      .writeFile(outputFilePath, "")
      .then(() => true)
      .catch((): any => null);
    if (!fileCreated) {
      throw new Error(`Error: Invalid file path '${outputFilePath}'`);
    }
  }

  await fs.writeFile(outputFilePath, content);
};

const processFilePathAndContent = async (
  filePath: string,
  content: string
): Promise<{ out: string }> => {
  const fileExists = await assertFileExists(filePath)
    .then(() => true)
    .catch(() => false);

  if (fileExists) {
    throw new Error("Error: Provide either a file path or content, not both");
  }

  console.warn(
    `Warning: Invalid file path '${filePath}'. Using provided content.`
  );
  return {
    out: processContent(content),
  };
};

const getTrailingNewlinesCount = (content: string): number => {
  const trailingNewlinesMatch = content.match(trailingNewlinesRegex);
  return trailingNewlinesMatch ? trailingNewlinesMatch[0].length : 0;
};

const updateTrailingNewlines = (
  content: string,
  trailingNewlinesCount: number
): string => {
  content = content.replace(/\n+/g, "\n");
  if (trailingNewlinesCount >= 1) {
    return content.replace(trailingNewlinesRegex, "\n");
  } else {
    return content.trimEnd();
  }
};

const processContent = (content: string) => {
  const lines = content.split("\n");
  const uniqueLines = lines.filter((line, index) => {
    line = line.replace(/\r/g, "");

    if (line == "") {
      return true; // keep empty lines
    }
    return index === 0 || lines[index - 1] !== line;
  });

  const outWithDuplicateNewslines = uniqueLines.join("\n");
  const trailingNewlinesCount = getTrailingNewlinesCount(content);
  const out = updateTrailingNewlines(
    outWithDuplicateNewslines,
    trailingNewlinesCount
  );
  return out;
};

const assertFileExists = async (filePath: string) => {
  try {
    await fs.access(filePath);
  } catch (error) {
    throw new Error(`Error: Invalid file path '${filePath}'`);
  }
};
