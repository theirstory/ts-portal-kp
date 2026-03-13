from spacy.language import Language
from spacy.tokens import Doc, Span, Token
import re
from spacy_models import get_en_sentence_nlp

# Helper function to create markdown with entities
def _create_markdown_with_entities(text, ents):
    """Create markdown text with entity markup from text and entities"""
    if not ents:
        return text
        
    # Sort entities by start position
    sorted_ents = sorted(ents, key=lambda e: e.start_char)
    
    markup_text = ""
    last_end = 0
    
    for ent in sorted_ents:
        # Add text before the entity
        markup_text += text[last_end:ent.start_char]
        
        # Add the entity with markup
        markup_text += f"[{ent.text}]{{{ent.label_}}}"
        
        # Update the last end position
        last_end = ent.end_char
    
    # Add any remaining text
    markup_text += text[last_end:]
    
    return markup_text

# Document level extensions
Doc.set_extension("sections", default=[], force=True)

# Add to_markdown extension for Doc
def doc_to_markdown(doc):
    """Convert the document to markdown format"""
    markdown = ""
    
    for section in doc._.sections:
        markdown += section._.to_markdown(doc) + "\n\n"
    
    return markdown

Doc.set_extension("to_markdown", method=doc_to_markdown, force=True)

# Section level extensions
Span.set_extension("paragraphs", default=[], force=True)
Span.set_extension("timestamp", default=None, force=True)
Span.set_extension("title", default=None, force=True)
Span.set_extension("synopsis", default=None, force=True)

# Add to_markdown extension for Section
def section_to_markdown(section, doc):
    """Convert a section to markdown format"""
    markdown = f"# {section._.title} ({section._.timestamp})\n\n"
    
    # Add section synopsis
    if section._.synopsis:
        markdown += f"*{section._.synopsis}*\n\n"
    
    # Add paragraphs
    for paragraph in section._.paragraphs:
        markdown += paragraph._.to_markdown(doc) + "\n"
    
    return markdown

Span.set_extension("to_markdown", method=section_to_markdown, force=True)

# Paragraph level extensions
Span.set_extension("sentences", default=[], force=True)
Span.set_extension("speaker", default=None, force=True)
Span.set_extension("start_time", default=None, force=True)
Span.set_extension("end_time", default=None, force=True)

# Add to_markdown extension for Paragraph
def paragraph_to_markdown(paragraph, doc):
    """Convert a paragraph to markdown format"""
    # Add speaker and timestamp
    markdown = f"**{paragraph._.speaker}** ({paragraph._.start_time} - {paragraph._.end_time}):\n"
    
    # Find entities in this paragraph
    para_ents = [ent for ent in doc.ents if ent.start >= paragraph.start and ent.end <= paragraph.end]
    
    if not para_ents:
        # No entities, just return the text
        markdown += f"{paragraph.text}\n"
        return markdown
    
    # Create a list of tokens in this paragraph
    para_tokens = [token for token in paragraph]
    para_text = paragraph.text
    
    # Create a mapping of entity tokens to their positions in the paragraph text
    entity_spans = []
    for ent in para_ents:
        # Calculate the relative token positions within the paragraph
        rel_start = ent.start - paragraph.start
        rel_end = ent.end - paragraph.start
        
        # Get the text span in the paragraph
        start_char = para_tokens[rel_start].idx - para_tokens[0].idx
        end_char = start_char + len(ent.text)
        
        entity_spans.append({
            'start': start_char,
            'end': end_char,
            'text': ent.text,
            'label': ent.label_
        })
    
    # Sort entities by start position
    entity_spans.sort(key=lambda e: e['start'])
    
    # Build marked up text
    marked_text = ""
    last_end = 0
    
    for span in entity_spans:
        # Add text before the entity
        marked_text += para_text[last_end:span['start']]
        
        # Add the entity with markup
        marked_text += f"[{span['text']}]{{{span['label']}}}"
        
        # Update the last end position
        last_end = span['end']
    
    # Add any remaining text
    marked_text += para_text[last_end:]
    
    # Add to markdown
    markdown += f"{marked_text}\n"
    
    return markdown

Span.set_extension("to_markdown", method=paragraph_to_markdown, force=True)

# Token level extensions
Token.set_extension("start_time", default=None, force=True)
Token.set_extension("end_time", default=None, force=True)

@Language.component("to_markdown")
def to_markdown(doc):
    """
    Reconstruct the original markup text from a spaCy doc with entities
    Returns text with [Entity]{entity_type} format
    """
    return _create_markdown_with_entities(doc.text, doc.ents)

@Language.component("from_markdown")
def from_markdown(text):
    """
    Extract entities from text with format: word [Entity]{entity_type} word
    Returns a list of dictionaries with entity information and clean text
    """
    pattern = r'\[(.*?)\]\{(.*?)\}'
    entities = []
    clean_text = ""
    last_end = 0
    offset = 0  # Track the offset caused by removing markup
    
    for match in re.finditer(pattern, text):
        entity_text = match.group(1)
        entity_type = match.group(2)
        markup_start = match.start()
        markup_end = match.end()
        
        # Add text before this entity to the clean text
        prefix_text = text[last_end:markup_start]
        clean_text += prefix_text
        
        # Calculate the actual entity text span in the clean text
        clean_start_char = len(clean_text)
        clean_text += entity_text
        clean_end_char = len(clean_text)
        
        # Store the entity with its position
        entities.append({
            'text': entity_text,
            'type': entity_type,
            'start_char': clean_start_char,
            'end_char': clean_end_char,
            'markup_start': markup_start,
            'markup_end': markup_end
        })
        
        # Update the last end position
        last_end = markup_end
    
    # Add any remaining text
    clean_text += text[last_end:]
    
    return entities, clean_text

@Language.component("from_json")
def from_json(doc, json_data, **kwargs):
    """
    Process JSON data and create a hierarchical document structure with:
    - Document containing sections
    - Sections containing paragraphs
    - Paragraphs containing sentences
    - All levels containing aligned tokens
    """
    # Get the nlp pipeline from the component config
    nlp = kwargs.get("nlp", None)
    if nlp is None:
        # Fallback to basic spaCy if no pipeline provided
        nlp = get_en_sentence_nlp()
    
    all_words = []
    all_word_data = []
    # First pass: collect all words and their metadata
    for section_idx, section in enumerate(json_data["sections"]):
        for para_idx, paragraph in enumerate(section["paragraphs"]):
            for word_idx, word in enumerate(paragraph["words"]):
                all_words.append(word["text"])
                word["section_idx"] = section_idx
                word["para_idx"] = para_idx
                word["word_idx"] = word_idx
                all_word_data.append(word)

    # Create the doc with all words
    doc = Doc(doc.vocab, words=all_words)
    
    # Second pass: add token metadata
    for i, token in enumerate(doc):
        word_data = all_word_data[i]
        token._.start_time = word_data["start"]
        token._.end_time = word_data["end"]
    
    # Third pass: create sections, paragraphs, and sentences
    current_section_idx = -1
    current_para_idx = -1
    current_section_span = None
    current_section_paragraphs = []
    section_spans = []

    section_start_token = 0
    para_start_token = 0

    def finalize_paragraph(end_token_idx):
        nonlocal current_section_paragraphs, para_start_token, current_para_idx, current_section_idx
        if current_para_idx < 0 or end_token_idx <= para_start_token:
            return

        para_span = doc[para_start_token:end_token_idx]
        para_data = json_data["sections"][current_section_idx]["paragraphs"][current_para_idx]
        para_span._.speaker = para_data["speaker"]
        para_span._.start_time = para_data["start"]
        para_span._.end_time = para_data["end"]
        current_section_paragraphs.append(para_span)

    def finalize_section(end_token_idx):
        nonlocal current_section_span, current_section_paragraphs, section_start_token, current_section_idx
        if current_section_idx < 0 or end_token_idx <= section_start_token:
            return

        section_span = doc[section_start_token:end_token_idx]
        section_data = json_data["sections"][current_section_idx]
        section_span._.timestamp = section_data["timestamp"]
        section_span._.title = section_data["title"]
        section_span._.synopsis = section_data["synopsis"]
        section_span._.paragraphs = list(current_section_paragraphs)
        section_spans.append(section_span)
        current_section_span = section_span
        current_section_paragraphs = []

    for i, token in enumerate(doc):
        word_data = all_word_data[i]
        
        # New section
        if word_data["section_idx"] != current_section_idx:
            # Close previous section if exists
            if current_section_idx >= 0:
                finalize_paragraph(i)
                finalize_section(i)
            
            # Start new section
            section_start_token = i
            current_section_idx = word_data["section_idx"]
            current_para_idx = -1
        
        # New paragraph
        if word_data["para_idx"] != current_para_idx:
            # Close previous paragraph if exists
            if current_para_idx >= 0:
                finalize_paragraph(i)
            
            # Start new paragraph
            para_start_token = i
            current_para_idx = word_data["para_idx"]
    
    # Close the last section and paragraph
    if current_section_idx >= 0:
        finalize_paragraph(len(doc))
        finalize_section(len(doc))
    
    # Add sections to document
    doc._.sections = section_spans
    

    for name, ner_component in nlp.pipeline:
        doc = ner_component(doc)
            
    # Convert the found entities to our document's space
    # doc = Doc(doc.vocab, words=[t.text for t in para])
    ents = []  # Move this here to accumulate across all paragraphs
    for ent in doc.ents:
        # The token indices in para_doc will match the relative positions in para
        # Calculate the absolute position in the main doc
        token_start = ent.start
        token_end = ent.end
        
        # Create the entity span
        doc_ent = Span(doc, token_start, token_end, label=ent.label_)
        # Add timing information from the corresponding tokens
        doc_ent._.start_time = doc[token_start]._.start_time
        doc_ent._.end_time = doc[token_end - 1]._.end_time
        ents.append(doc_ent)
    
    if ents:
        doc.ents = ents
        print(f"Found {len(ents)} entities in the document")

    final_ents = []
    for ent in doc.ents:
        ent.label_ = ent.label_.replace(" ", "_")
        final_ents.append(ent)

    doc.ents = final_ents

    
    # Replace spaces with underscores in entity labels
    return doc

class TheirStory:
    """
    Pipeline for theirstory.
    """
    def __init__(self, labels=['named person', 'nationality or religious political group', 'organization', 'location', 'event',
                  'named book poem and song', 'language', 'date',
                  'literary practice', 'emotion state of mind',
                  'social structure', 'morality and ethics', 'art media and aesthetics', 'philosophy', 'spirituality',
                  'technology', 'nature', 'science', 'fictional location', 'cultural event', 'award', 'movement',
                  'publication or publishing house'], gliner_model="TheirStory/92ny-gliner-large-v2.5"):
        
        custom_spacy_config = { 
                            # "gliner_model": "wjbmattingly/92ny-gliner-v2",
                            "gliner_model": gliner_model,
                            "chunk_size": 300,
                            "labels": labels,
                            "style": "ent",
                            "map_location": "cpu",
                            }
        # Main pipeline with our custom components
        self.nlp = get_en_sentence_nlp()

        # Separate pipeline just for NER
        self.ner_nlp = get_en_sentence_nlp()
        # self.ner_nlp.add_pipe("sentencizer")
        # self.ner_nlp.add_pipe("gliner_spacy", config=custom_spacy_config)
        
        # Add custom extensions for entity timing
        if not Span.has_extension("start_time"):
            Span.set_extension("start_time", default=None)
        if not Span.has_extension("end_time"):
            Span.set_extension("end_time", default=None)
        # Add the from_json component
        self.nlp.add_pipe("from_json")
        
    def parse_json(self, json_data):
        doc = Doc(self.nlp.vocab, words=[])
        # Pass the NER pipeline when calling the component
        return self.nlp.get_pipe("from_json")(doc, json_data, nlp=self.ner_nlp)
